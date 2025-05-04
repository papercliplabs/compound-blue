import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId, MathLib } from "@morpho-org/blue-sdk";
import {
  getMarketSimulationStateAccountingForPublicReallocation,
  getSignatureRequirementDescription,
  getTransactionRequirementDescription,
  PrepareActionReturnType,
  SimulatedValueChange,
} from "../helpers";
import { Address, Client, erc20Abi, maxUint256 } from "viem";
import { getIsContract } from "@/data/getIsContract";
import { computeLeverageValues } from "./computeLeverageValues";
import { BundlerCall, BundlerAction, encodeBundle } from "@morpho-org/bundler-sdk-viem";
import { ActionBundle, populateSubBundle } from "@morpho-org/bundler-sdk-viem";
import { CHAIN_ID } from "@/config";
import { readContract } from "viem/actions";
import { getParaswapExactBuy } from "@/data/paraswap/getParaswapExactBuy";
import { createBundle, paraswapBuy } from "../bundler3";
import { GetParaswapReturnType } from "@/data/paraswap/types";
import { GENERAL_ADAPTER_1_ADDRESS, MORPHO_BLUE_ADDRESS, PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";
import { prepareInputTransferSubbundle } from "../subbundles/prepareInputTransferSubbundle";
import { Subbundle } from "../subbundles/types";

interface PrepareMarketLeveragedBorrowActionParameters {
  publicClient: Client;
  marketId: MarketId;
  allocatingVaultAddresses: Address[];

  accountAddress: Address;

  initialCollateralAmount: bigint; // a.k.a margin, uint256 max for entire wallet balance
  leverageFactor: number; // (1, (1 + S) / (1 + S - LLTV_WITH_MARGIN))]
  maxSlippageTolerance: number; // (0,1)
}

export type PrepareMarketLeveragedBorrowActionReturnType =
  | (Extract<PrepareActionReturnType, { status: "success" }> & {
      positionCollateralChange: SimulatedValueChange<bigint>;
      positionLoanChange: SimulatedValueChange<bigint>;
      positionLtvChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareActionReturnType, { status: "error" }>;

export async function prepareMarketLeveragedBorrowAction({
  publicClient,
  marketId,
  allocatingVaultAddresses,

  accountAddress,

  initialCollateralAmount,
  leverageFactor,
  maxSlippageTolerance,
}: PrepareMarketLeveragedBorrowActionParameters): Promise<PrepareMarketLeveragedBorrowActionReturnType> {
  // Input validation performed within computeLeverageValues

  let market = await fetchMarket(marketId, publicClient);
  const { collateralToken: collateralTokenAddress, loanToken: loanTokenAddress } = market.params;

  const accountCollateralBalance = await readContract(publicClient, {
    address: collateralTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [accountAddress],
  });

  const initialCollateralAmountInternal =
    initialCollateralAmount == maxUint256 ? accountCollateralBalance : initialCollateralAmount;

  let collateralAmount: bigint;
  let loanAmount: bigint;
  try {
    const values = computeLeverageValues(initialCollateralAmountInternal, leverageFactor, maxSlippageTolerance, market);
    collateralAmount = values.collateralAmount;
    loanAmount = values.loanAmount;
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "An unknown error occurred",
    };
  }

  const [simulationState, isContract] = await Promise.all([
    getMarketSimulationStateAccountingForPublicReallocation({
      accountAddress,
      marketId,
      publicClient,
      allocatingVaultAddresses,
      requestedBorrowAmount: loanAmount,
    }),
    getIsContract(publicClient, accountAddress),
  ]);
  market = simulationState.getMarket(marketId);

  const accountPosition = simulationState.getPosition(accountAddress, marketId);

  const positionCollateralBefore = accountPosition.collateral;
  const positionLoanBefore = market.toBorrowAssets(accountPosition.borrowShares);
  const positionLtvBefore = market.getLtv(accountPosition) ?? 0n;

  const requiredSwapCollateralAmount = collateralAmount - initialCollateralAmountInternal;

  let inputTransferSubbundle: Subbundle;
  let borrowSubBundleEncoded: ActionBundle; // Use subBundle here to so that it handles any required public reallocation and requirement's (besides aToken approval)
  try {
    inputTransferSubbundle = prepareInputTransferSubbundle({
      accountAddress,
      tokenAddress: collateralTokenAddress,
      amount: initialCollateralAmount,
      recipientAddress: GENERAL_ADAPTER_1_ADDRESS,
      config: {
        accountSupportsSignatures: !isContract,
        tokenIsRebasing: false,
        allowWrappingNativeAssets: false,
      },
      simulationState,
    });

    // Simulate the state changes for actions not supported by the Morpho SDK
    accountPosition.collateral += collateralAmount;

    const borrowSubBundle = populateSubBundle(
      {
        type: "Blue_Borrow",
        sender: accountAddress,
        address: MORPHO_BLUE_ADDRESS,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          receiver: PARASWAP_ADAPTER_ADDRESS,
          assets: loanAmount,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE, // On share price, diff from swap slippage
        },
      },
      simulationState,
      {
        publicAllocatorOptions: {
          enabled: true,
        },
      }
    );

    borrowSubBundleEncoded = encodeBundle(borrowSubBundle, simulationState, !isContract);
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }

  const maxSharePriceE27 = market.toSupplyShares(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

  let paraswapQuote: GetParaswapReturnType;
  try {
    paraswapQuote = await getParaswapExactBuy({
      publicClient: publicClient,
      accountAddress: PARASWAP_ADAPTER_ADDRESS, // User is the paraswap adapter...
      srcTokenAddress: loanTokenAddress,
      destTokenAddress: collateralTokenAddress,
      maxSrcTokenAmount: loanAmount,
      exactDestTokenAmount: requiredSwapCollateralAmount,
    });
  } catch {
    return {
      status: "error",
      message: `No swap route found respecting slippage tolerance.`,
    };
  }

  function getBundleTx() {
    const encodedBorrowBundlerCalls = borrowSubBundleEncoded.actions.map((action) =>
      BundlerAction.encode(CHAIN_ID, action)
    );

    const bundlerCalls: BundlerCall[] = [
      // Move margin from user into GA1
      ...inputTransferSubbundle.bundlerCalls,
      BundlerAction.morphoSupplyCollateral(
        CHAIN_ID,
        market.params,
        collateralAmount,
        accountAddress,
        // Supply collateral callbacks, all actions will happen before Morpho pulls the required collateral from GA1 (i.e must have required collateral in GA1 at the end of these callbacks)
        [
          // Take borrow against collateral sending to paraswap adapter.
          ...encodedBorrowBundlerCalls,
          // Use Paraswap adapter to Buy exact amount of collateral needed using loan tokens, sending output to GA1
          paraswapBuy(
            paraswapQuote.augustus,
            paraswapQuote.calldata,
            loanTokenAddress,
            collateralTokenAddress,
            paraswapQuote.offsets,
            GENERAL_ADAPTER_1_ADDRESS
          ),
          // Sweep any remaing loan tokens from Paraswap adapter back to GA1
          BundlerAction.erc20Transfer(
            loanTokenAddress,
            GENERAL_ADAPTER_1_ADDRESS,
            maxUint256,
            PARASWAP_ADAPTER_ADDRESS
          ),
        ].flat()
      ),
      // Collateral will be withdrawn from GA1 here to complete the supply collateral

      // Sweep any remaining collateral from GA1 to user
      BundlerAction.erc20Transfer(collateralTokenAddress, accountAddress, maxUint256, GENERAL_ADAPTER_1_ADDRESS),

      // Use any leftover loan tokens in GA1 to repay the loan to lower LTV
      BundlerAction.morphoRepay(CHAIN_ID, market.params, maxUint256, 0n, maxSharePriceE27, accountAddress, [], true),
    ].flat();

    return createBundle(bundlerCalls);
  }

  const simulationStateAfter = borrowSubBundleEncoded.steps?.[borrowSubBundleEncoded.steps.length - 1];
  const marketAfter = simulationStateAfter?.getMarket(marketId);
  const userPositionAfter = simulationStateAfter?.getPosition(accountAddress, marketId);

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
        name: "Confirm Multiply",
        tx: getBundleTx,
      },
    ],
    positionCollateralChange: {
      before: positionCollateralBefore,
      after: userPositionAfter?.collateral ?? 0n,
    },
    positionLoanChange: {
      before: positionLoanBefore,
      after: marketAfter?.toBorrowAssets(userPositionAfter?.borrowShares ?? 0n) ?? 0n,
    },
    positionLtvChange: {
      before: positionLtvBefore,
      after: marketAfter?.getLtv(userPositionAfter ?? { collateral: 0n, borrowShares: 0n }) ?? 0n,
    },
  };
}
