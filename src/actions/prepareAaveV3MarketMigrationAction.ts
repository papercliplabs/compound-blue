import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId, MathLib } from "@morpho-org/blue-sdk";
import {
  computeAmountWithRebasingMargin,
  getMarketSimulationStateAccountingForPublicReallocation,
  getSignatureRequirementDescription,
  getTransactionRequirementDescription,
  PrepareActionReturnType,
} from "./helpers";
import { Address, Client, erc20Abi, maxUint256 } from "viem";
import { BundlerAction, BundlerCall, encodeBundle, populateSubBundle } from "@morpho-org/bundler-sdk-viem";
import { AAVE_V3_POOL_ADDRESS, CHAIN_ID } from "@/config";
import { readContract } from "viem/actions";
import { aaveV3PoolAbi } from "@/abis/aaveV3PoolAbi";
import { getIsContract } from "@/data/getIsContract";
import { bigIntMin } from "@/utils/bigint";
import { createBundle } from "./bundler3";
import { AAVE_V3_MIGRATION_ADAPTER_ADDRESS, GENERAL_ADAPTER_1_ADDRESS, MORPHO_BLUE_ADDRESS } from "@/utils/constants";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";
import { prepareInputTransferSubbundle } from "./subbundles/prepareInputTransferSubbundle";

// Note: For full debt repayments, due to the rebasing margin the Morpho loan amount can be worse case 0.03% higher than requested, so requested LTV must be at least 0.03% below LLTV (MAX_BORROW_LTV_MARGIN solves).
// Note: If the transaction is not executed before the margin is consumed from rebasing the following will occur:
//   * collateralBalance rebases higher than current with margin: Migration execution will fail due to insufficient aToken approval
//   * loanBalance rebases higher than current with margin: Migration will succeed if there are other collateral assets left in Aave. This will leave the Aave position with some dust borrowing.
//                                                          This is acceptable as it will be a VERY rare occurance.

interface PrepareAaveV3MarketMigrationActionParameters {
  publicClient: Client;
  accountAddress: Address;
  marketId: MarketId;
  collateralTokenAmount: bigint; // Max uint256 for entire AAVE collateral balance (note: aTokens and their underlying have same decimals and are 1:1)
  loanTokenAmount: bigint; // Max uint256 for entire AAVE loan amount
  allocatingVaultAddresses: Address[];
}

export async function prepareAaveV3MarketMigrationAction({
  publicClient,
  accountAddress,
  marketId,
  collateralTokenAmount,
  loanTokenAmount,
  allocatingVaultAddresses,
}: PrepareAaveV3MarketMigrationActionParameters): Promise<PrepareActionReturnType> {
  if (collateralTokenAmount <= 0n || loanTokenAmount <= 0n) {
    return {
      status: "error",
      message: "Collateral and loan token amounts must be greater than 0.",
    };
  }

  const { collateralToken: collateralTokenAddress, loanToken: loanTokenAddress } = (
    await fetchMarket(marketId, publicClient)
  ).params;

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
  const [accountATokenBalance, accountVTokenBalance] = await Promise.all([
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
  ]);

  const isFullCollateralMigration = collateralTokenAmount == maxUint256;
  const isFullDebtMigration = loanTokenAmount == maxUint256;

  // Borrow a bit more to account for rebasing if full debt migration (diff gets repaid at the end)
  const borrowAmount = isFullDebtMigration ? computeAmountWithRebasingMargin(accountVTokenBalance) : loanTokenAmount;

  const [simulationState, isContract] = await Promise.all([
    getMarketSimulationStateAccountingForPublicReallocation({
      accountAddress,
      marketId,
      publicClient,
      allocatingVaultAddresses,
      requestedBorrowAmount: borrowAmount,
      additionalTokenAddresses: [aTokenAddress],
    }),
    getIsContract(publicClient, accountAddress),
  ]);
  const market = simulationState.getMarket(marketId);

  if (market.price == undefined || market.price == 0n) {
    return {
      status: "error",
      message: "Missing market oracle price.",
    };
  }

  try {
    const inputTransferSubbundle = prepareInputTransferSubbundle({
      accountAddress,
      tokenAddress: aTokenAddress,
      amount: collateralTokenAmount, // Handles maxUint256
      recipientAddress: AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
      config: {
        accountSupportsSignatures: !isContract,
        tokenIsRebasing: true, // Is rebasing, this will handle extra approval for full migrations
        allowWrappingNativeAssets: false,
      },
      simulationState,
    });

    // Simulate the AAVE collateral withdraw and deposit into Morpho market
    const adapterHolding = simulationState.getHolding(AAVE_V3_MIGRATION_ADAPTER_ADDRESS, aTokenAddress);
    const position = simulationState.getPosition(accountAddress, marketId);
    position.collateral += adapterHolding.balance;
    adapterHolding.balance = 0n;

    const borrowSubBundle = populateSubBundle(
      {
        type: "Blue_Borrow",
        sender: accountAddress,
        address: MORPHO_BLUE_ADDRESS,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          receiver: AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
          assets: borrowAmount,
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
    const borrowSubBundleEncoded = encodeBundle(borrowSubBundle, simulationState, !isContract);

    const maxSharePriceE27 = market.toSupplyShares(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

    function getBundleTx() {
      const encodedBorrowBundlerCalls = borrowSubBundleEncoded.actions.map((action) =>
        BundlerAction.encode(CHAIN_ID, action)
      );
      const bundlerCalls: BundlerCall[] = [
        BundlerAction.morphoSupplyCollateral(
          CHAIN_ID,
          market.params,
          bigIntMin(accountATokenBalance, collateralTokenAmount), // Minimum collateral amount, any excess will be added at the end
          accountAddress,
          // Supply collateral callbacks, all actions will happen before Morpho pulls the required collateral from GA1 (i.e must have required collateral in GA1 at the end of these callbacks)
          [
            // Take borrow against collateral sending to aaveV3MigrationAdapter.
            ...encodedBorrowBundlerCalls,
            // Use aaveV3MigrationAdapter to repay accounts borrow
            BundlerAction.aaveV3Repay(CHAIN_ID, loanTokenAddress, maxUint256, accountAddress, 2n), // 2 is the rate mode AAVE uses for variable debt (only one used)
            // Skim any left over loan assets from aaveV3MigrationAdapter to GA1 (only occurs for full debt migrations)
            BundlerAction.erc20Transfer(
              loanTokenAddress,
              GENERAL_ADAPTER_1_ADDRESS,
              maxUint256,
              AAVE_V3_MIGRATION_ADAPTER_ADDRESS
            ),
            // Perform input transfer of aTokens to aave migration adapter. Note that this must happen after the repay has occured.
            ...inputTransferSubbundle.bundlerCalls,
            // Use aaveV3MigrationAdapter to withdraw collateral to GA1 by redeem all aTokens in the contract
            BundlerAction.aaveV3Withdraw(CHAIN_ID, collateralTokenAddress, maxUint256, GENERAL_ADAPTER_1_ADDRESS),
          ].flat()
        ),
        // Collateral will be withdrawn from GA1 here to complete the supply collateral

        // For full collateral migrations might be dust collateral assets in GA1 from rebasing margin.
        // Use these to supply a bit more collateral.
        ...(isFullCollateralMigration
          ? [BundlerAction.morphoSupplyCollateral(CHAIN_ID, market.params, maxUint256, accountAddress, [], true)]
          : []),

        // For full debt migrations might be dust loan assets in GA1 from rebasing margin.
        // Use these to repay a bit of the loan.
        ...(isFullDebtMigration
          ? [BundlerAction.morphoRepay(CHAIN_ID, market.params, maxUint256, 0n, maxSharePriceE27, accountAddress, [])]
          : []),
      ].flat();

      return createBundle(bundlerCalls);
    }

    return {
      status: "success",
      signatureRequests: [
        ...inputTransferSubbundle.signatureRequirements,
        ...borrowSubBundleEncoded.requirements.signatures.map((sig) => ({
          sign: sig.sign,
          name: getSignatureRequirementDescription(sig, simulationState),
        })),
      ],
      transactionRequests: [
        ...inputTransferSubbundle.transactionRequirements,
        ...borrowSubBundleEncoded.requirements.txs.map((tx) => ({
          tx: () => tx.tx,
          name: getTransactionRequirementDescription(tx, simulationState),
        })),
        {
          name: "Confirm Migration",
          tx: getBundleTx,
        },
      ],
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
