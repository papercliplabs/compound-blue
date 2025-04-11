import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId, MathLib } from "@morpho-org/blue-sdk";
import {
  getMarketSimulationStateAccountingForPublicReallocation,
  getSignatureRequirementDescription,
  getTransactionRequirementDescription,
  PrepareActionReturnType,
  SimulatedValueChange,
} from "../helpers";
import { Address, Client, encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";
import { computeLeverageValues } from "./computeLeverageValues";
import { BundlerCall, BundlerAction, encodeBundle } from "@morpho-org/bundler-sdk-viem";
import { ActionBundle, populateSubBundle } from "@morpho-org/bundler-sdk-viem";
import { CHAIN_ID } from "@/config";
import { readContract } from "viem/actions";
import { TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { getParaswapExactBuy } from "@/data/paraswap/getParaswapExactBuy";
import { createBundle, morphoRepay, paraswapBuy } from "../bundler3";
import { trackEvent } from "@/data/trackEvent";
import { GetParaswapReturnType } from "@/data/paraswap/common";
import { GENERAL_ADAPTER_1_ADDRESS, MORPHO_BLUE_ADDRESS, PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";

interface PrepareMarketLeveragedBorrowActionParameters {
  publicClient: Client;
  marketId: MarketId;
  allocatingVaultAddresses: Address[];

  accountAddress: Address;

  initialCollateralAmount: bigint; // a.k.a margin, uint256 max for entire wallet balance
  leverageFactor: number; // (1, 1/(1-LLTV * (1-maxSlippageTolerance))]
  maxSlippageTolerance: number; // (0,1)
}

export type PrepareMarketLeveragedBorrowActionReturnType =
  | (Omit<
      Extract<PrepareActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
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
  if (!PARASWAP_ADAPTER_ADDRESS) {
    return {
      status: "error",
      message: "Leverage is not supported (missing adapter).",
    };
  }

  let market = await fetchMarket(marketId, publicClient);
  const { collateralToken: collateralTokenAddress, loanToken: loanTokenAddress } = market.params;

  const [accountCollateralBalance, allowance] = await Promise.all([
    readContract(publicClient, {
      address: collateralTokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [accountAddress],
    }),
    readContract(publicClient, {
      abi: erc20Abi,
      address: collateralTokenAddress,
      functionName: "allowance",
      args: [accountAddress, GENERAL_ADAPTER_1_ADDRESS],
    }),
  ]);

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

  const [simulationState, isSmartAccount] = await Promise.all([
    getMarketSimulationStateAccountingForPublicReallocation({
      accountAddress,
      marketId,
      publicClient,
      allocatingVaultAddresses,
      requestedBorrowAmount: loanAmount,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);
  market = simulationState.getMarket(marketId);

  const accountPosition = simulationState.getPosition(accountAddress, marketId);

  const positionCollateralBefore = accountPosition.collateral;
  const positionLoanBefore = market.toBorrowAssets(accountPosition.borrowShares);
  const positionLtvBefore = market.getLtv(accountPosition) ?? BigInt(0);

  const requiredSwapCollateralAmount = collateralAmount - initialCollateralAmountInternal;

  // Should use permit2...
  const collateralTokenApproveTx: ReturnType<TransactionRequest["tx"]> = {
    to: collateralTokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [GENERAL_ADAPTER_1_ADDRESS, initialCollateralAmountInternal],
    }),
    value: BigInt(0),
  };

  // Override simulation state for actions not supported by the simulation SDK
  accountPosition.collateral += collateralAmount;

  // Use subBundle here to so that it handles any required public reallocation and requirement's (besides aToken approval)
  let borrowSubBundleEncoded: ActionBundle;
  try {
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

    borrowSubBundleEncoded = encodeBundle(borrowSubBundle, simulationState, !isSmartAccount);
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
  } catch (e) {
    trackEvent("paraswap-error", { error: e instanceof Error ? e.message : JSON.stringify(e) });
    return {
      status: "error",
      message: `Swap Error: Unable to get quote.`,
    };
  }

  function getBundleTx() {
    const encodedBorrowBundlerCalls = borrowSubBundleEncoded.actions.map((action) =>
      BundlerAction.encode(CHAIN_ID, action)
    );

    const bundlerCalls: BundlerCall[] = [
      // Move margin from user into GA1
      BundlerAction.erc20TransferFrom(
        CHAIN_ID,
        collateralTokenAddress,
        initialCollateralAmount,
        GENERAL_ADAPTER_1_ADDRESS
      ),
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
            CHAIN_ID,
            loanTokenAddress,
            GENERAL_ADAPTER_1_ADDRESS,
            maxUint256,
            PARASWAP_ADAPTER_ADDRESS
          ),
        ].flat()
      ),
      // Collateral will be withdrawn from GA1 here to complete the supply collateral

      // Use any leftover loan tokens in GA1 to repay the loan to lower LTV
      morphoRepay(CHAIN_ID, market.params, maxUint256, BigInt(0), maxSharePriceE27, accountAddress, [], true),
    ].flat();

    return createBundle(bundlerCalls);
  }

  const simulationStateAfter = borrowSubBundleEncoded.steps?.[borrowSubBundleEncoded.steps.length - 1];
  const marketAfter = simulationStateAfter?.getMarket(marketId);
  const userPositionAfter = simulationStateAfter?.getPosition(accountAddress, marketId);

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
      //  TODO: should use permit2 if possible...
      ...(allowance < initialCollateralAmountInternal
        ? [
            {
              name: `Approve Collateral`,
              tx: () => collateralTokenApproveTx,
            },
          ]
        : []),
      {
        name: "Confirm Multiply",
        tx: getBundleTx,
      },
    ],
    positionCollateralChange: {
      before: positionCollateralBefore,
      after: userPositionAfter?.collateral ?? BigInt(0),
    },
    positionLoanChange: {
      before: positionLoanBefore,
      after: marketAfter?.toBorrowAssets(userPositionAfter?.borrowShares ?? BigInt(0)) ?? BigInt(0),
    },
    positionLtvChange: {
      before: positionLtvBefore,
      after: marketAfter?.getLtv(userPositionAfter ?? { collateral: BigInt(0), borrowShares: BigInt(0) }) ?? BigInt(0),
    },
  };
}
