import { addresses, DEFAULT_SLIPPAGE_TOLERANCE, MarketId, MathLib } from "@morpho-org/blue-sdk";
import {
  getSignatureRequirementDescription,
  getTransactionRequirementDescription,
  PrepareActionReturnType,
} from "./helpers";
import { Address, Client, encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import {
  ActionBundle,
  BundlerAction,
  BundlerCall,
  encodeBundle,
  populateSubBundle,
} from "@morpho-org/bundler-sdk-viem";
import { AAVE_V3_POOL_ADDRESS, CHAIN_ID } from "@/config";
import { TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { getSimulationState } from "@/data/getSimulationState";
import { readContract } from "viem/actions";
import { aaveV3PoolAbi } from "@/abis/aaveV3PoolAbi";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";
import { bigIntMin } from "@/utils/bigint";
import { createBundle, morphoSupplyCollateral } from "./bundler3";

const { morpho: morphoBlueAddress, bundler3 } = addresses[CHAIN_ID];

// 0.03% buffer on full balance transfers to account for accrued interest between now and execution (both on aTokens/collateral and the vTokens/loan).
// This gives ~1 day grace period for execution for markets with 10% APY which is useful for multisigs.
// This means the Morpho loan amount for full debt repayments can be worse case 0.03% higher than requested, so requested LTV must be at least 0.03% below LLTV.
// Note that if the transaction is not executed before the margin is consumed from rebasing the following will occur:
//   * collateralBalance rebases higher than current with margin: Migration execution will fail due to insufficient aToken approval
//   * loanBalance rebases higher than current with margin: Migration will succeed if there are other collateral assets left in Aave. This will leave the Aave position with some dust borrowing.
//                                                          This is acceptable as it will be a very rare occurance.
// Also, if the transaction is executed more than a day late it will fail due to expired morpho authorization.
const REBASEING_MARGIN = BigInt(100030);
const REBASEING_MARGIN_SCALE = BigInt(100000);

interface PrepareAaveV3MarketMigrationActionParameters {
  publicClient: Client;
  accountAddress: Address;
  marketId: MarketId;
  collateralTokenAmount: bigint; // Max uint256 for entire AAVE collateral balance (note: aTokens and their underlying have same decimals)
  loanTokenAmount: bigint; // Max uint256 for entire AAVE loan amount
  requiresPublicReallocation: boolean;
  allocatingVaultAddresses: Address[];
}

export async function prepareAaveV3MarketMigrationAction({
  publicClient,
  accountAddress,
  marketId,
  collateralTokenAmount,
  loanTokenAmount,
  requiresPublicReallocation,
  allocatingVaultAddresses,
}: PrepareAaveV3MarketMigrationActionParameters): Promise<PrepareActionReturnType> {
  const { aaveV3CoreMigrationAdapter: aaveV3MigrationAdapterAddress, paraswapAdapter: paraswapAdapterAddress } =
    bundler3;

  if (!aaveV3MigrationAdapterAddress || !paraswapAdapterAddress) {
    return {
      status: "error",
      message: "Aave V3 Migrations are not currently supported (missing adapter(s)).",
    };
  }

  if (loanTokenAmount == BigInt(0) || collateralTokenAmount == BigInt(0)) {
    return {
      status: "error",
      message: "Collateral and loan token amount cannot be 0.",
    };
  }

  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "market-supply-collateral-borrow",
      accountAddress,
      marketId,
      publicClient,
      allocatingVaultAddresses,
      requiresReallocation: requiresPublicReallocation,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const market = simulationState.getMarket(marketId);
  const { collateralToken: collateralTokenAddress, loanToken: loanTokenAddress } = market.params;

  if (!market.price) {
    return {
      status: "error",
      message: "Error fetching market oracle price.",
    };
  }

  const [aTokenAddress, variableDebtTokenAddress] = await Promise.all([
    readContract(publicClient, {
      address: AAVE_V3_POOL_ADDRESS,
      abi: aaveV3PoolAbi,
      functionName: "getReserveAToken",
      args: [collateralTokenAddress],
    }),
    readContract(publicClient, {
      address: AAVE_V3_POOL_ADDRESS,
      abi: aaveV3PoolAbi,
      functionName: "getReserveVariableDebtToken",
      args: [loanTokenAddress],
    }),
  ]);

  // vTokens are variable debt tokens representing current debt amount
  const [accountATokenBalance, accountVTokenBalance, allowance] = await Promise.all([
    readContract(publicClient, {
      address: aTokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accountAddress],
    }),
    readContract(publicClient, {
      address: variableDebtTokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accountAddress],
    }),
    readContract(publicClient, {
      abi: erc20Abi,
      address: aTokenAddress,
      functionName: "allowance",
      args: [accountAddress, bundler3.generalAdapter1],
    }),
  ]);

  const isFullCollateralMigration = collateralTokenAmount == maxUint256;
  const isFullDebtMigration = loanTokenAmount == maxUint256;

  // Must give a buffer for full migrations since aTokens and vTokens are rebasing and will accrue interest between now and execution.
  const requiredATokenAllowance = isFullCollateralMigration
    ? (accountATokenBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE
    : collateralTokenAmount;

  const initialBorrowAmount = isFullDebtMigration
    ? (accountVTokenBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE
    : loanTokenAmount;

  // Could use permit2, but AAVE doesn't use permit2, and the assumption is the user likely will only do this once, so direct approval is actually more user friendly (2 steps instead of 3).
  // aTokens do support permit, which would be best, but keeping simple for now.
  const aTokenApproveTx: ReturnType<TransactionRequest["tx"]> = {
    to: aTokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [bundler3.generalAdapter1, requiredATokenAllowance],
    }),
    value: BigInt(0),
  };

  // Override simulation state for actions not supported by the simulation SDK
  const position = simulationState.getPosition(accountAddress, marketId);
  position.collateral += collateralTokenAmount;

  // Use subBundle here to so that it handles any required public reallocation and requirement's (besides aToken approval)
  let borrowSubBundleEncoded: ActionBundle;
  try {
    const borrowSubBundle = populateSubBundle(
      {
        type: "Blue_Borrow",
        sender: accountAddress,
        address: morphoBlueAddress,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          receiver: aaveV3MigrationAdapterAddress,
          assets: initialBorrowAmount,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
      simulationState,
      {
        publicAllocatorOptions: {
          enabled: true,
        },
      }
    );

    borrowSubBundleEncoded = encodeBundle(borrowSubBundle, simulationState, !isSmartAccount);
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }

  const maxSharePriceE27 = market.toSupplyShares(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

  function getBundleTx() {
    const encodedBorrowBundlerCalls = borrowSubBundleEncoded.actions.map((action) =>
      BundlerAction.encode(CHAIN_ID, action)
    );
    const bundlerCalls: BundlerCall[] = [
      morphoSupplyCollateral(
        CHAIN_ID,
        market.params,
        bigIntMin(accountATokenBalance, collateralTokenAmount), // Minimum collateral amount, any excess will be added at the end
        accountAddress,
        // Supply collateral callbacks, all actions will happen before Morpho pulls the required collateral from GA1 (i.e must have required collateral in GA1 at the end of these callbacks)
        [
          // Take borrow against collateral sending to aaveV3MigrationAdapter.
          ...encodedBorrowBundlerCalls,
          // Use aaveV3MigrationAdapter to repay accounts borrow
          BundlerAction.aaveV3Repay(CHAIN_ID, loanTokenAddress, maxUint256, accountAddress, BigInt(2)),
          // Skim any left over loan assets from aaveV3MigrationAdapter to GA1 (only occurs for full debt migrations)
          BundlerAction.erc20Transfer(
            CHAIN_ID,
            loanTokenAddress,
            bundler3.generalAdapter1,
            maxUint256,
            aaveV3MigrationAdapterAddress!
          ),
          // Use GA1 to move aTokens into aaveV3MigrationAdapter, GA1 must have previously been approved to do so
          BundlerAction.erc20TransferFrom(
            CHAIN_ID,
            aTokenAddress,
            collateralTokenAmount, // aTokens and underlying have same number of decimals
            bundler3.aaveV3CoreMigrationAdapter
          ),
          // Use aaveV3MigrationAdapter to withdraw collateral to GA1 by redeem all aTokens in the contract
          BundlerAction.aaveV3Withdraw(CHAIN_ID, collateralTokenAddress, maxUint256, bundler3.generalAdapter1),
        ].flat()
      ),
      // Collateral will be withdrawn from GA1 here to complete the supply collateral

      // For full collateral migrations might be left with small amount of collateral in GA1 (<REBASING_MARGIN of collateral amount)
      // Skip revert handles the case where there is no dust which can occur for low interest collateral assets.
      ...(isFullCollateralMigration
        ? [morphoSupplyCollateral(CHAIN_ID, market.params, maxUint256, accountAddress, [], true)]
        : []),

      // For full debt migrations will be left with full loan amount in GA1 (<REBASING_MARGIN of loan amount)
      // Will always have assets in this case unlike the full collateral migration (except an almost impossible corner case of borrow at exact time interest has accrued to perfectly use margin).
      ...(isFullDebtMigration
        ? [
            BundlerAction.morphoRepay(
              CHAIN_ID,
              market.params,
              maxUint256,
              BigInt(0),
              maxSharePriceE27,
              accountAddress,
              []
            ),
          ]
        : []),
    ].flat();

    const bundle = createBundle(bundlerCalls);
    return bundle;
  }

  return {
    status: "success",
    signatureRequests: borrowSubBundleEncoded.requirements.signatures.map((sig) => ({
      sign: sig.sign,
      name: getSignatureRequirementDescription(sig, simulationState),
    })),
    transactionRequests: [
      ...borrowSubBundleEncoded.requirements.txs.map((tx) => ({
        tx: () => tx.tx,
        name: getTransactionRequirementDescription(tx, simulationState),
      })),
      ...(allowance < requiredATokenAllowance
        ? [
            {
              name: "Approve aTokens",
              tx: () => aTokenApproveTx,
            },
          ]
        : []),
      {
        name: "Confirm Migration",
        tx: getBundleTx,
      },
    ],
  };
}
