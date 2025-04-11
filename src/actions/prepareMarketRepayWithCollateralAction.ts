import { addresses, DEFAULT_SLIPPAGE_TOLERANCE, MarketId, MathLib, ORACLE_PRICE_SCALE } from "@morpho-org/blue-sdk";
import {
  getSignatureRequirementDescription,
  getTransactionRequirementDescription,
  PrepareActionReturnType,
  SimulatedValueChange,
} from "./helpers";
import { Address, Client, maxUint256 } from "viem";
import { getSimulationState } from "@/data/getSimulationState";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";
import {
  BundlerCall,
  BundlerAction,
  ActionBundle,
  populateSubBundle,
  encodeBundle,
} from "@morpho-org/bundler-sdk-viem";
import { CHAIN_ID } from "@/config";
import { getParaswapExactBuy } from "@/data/paraswap/getParaswapExactBuy";
import { createBundle, morphoSupplyCollateral, paraswapBuy } from "./bundler3";
import { trackEvent } from "@/data/trackEvent";
import { GetParaswapReturnType } from "@/data/paraswap/common";

// 0.03% buffer on full loan repayments to account for accrued interest between now and execution.
// This gives ~1 day grace period for execution for markets with 10% APY which is useful for multisigs.
// This also causes some dust leftover loan assets to be sent to the user during full loan repayments.
const FACTOR_SCALE = 100000;
const REBASEING_MARGIN = BigInt(100030);

const { morpho: morphoBlueAddress, bundler3: bundler3Addresses } = addresses[CHAIN_ID];

interface PrepareMarketRepayWithCollateralActionParameters {
  publicClient: Client;
  accountAddress: Address;
  marketId: MarketId;
  loanRepayAmount: bigint; // max uint256 for entire position
  maxSlippageTolerance: number; // (0,1)
}

export type PrepareMarketRepayWithCollateralActionReturnType =
  | (Omit<
      Extract<PrepareActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionCollateralChange: SimulatedValueChange<bigint>;
      positionLoanChange: SimulatedValueChange<bigint>;
      positionLtvChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareActionReturnType, { status: "error" }>;

export async function prepareMarketRepayWithCollateralAction({
  publicClient,
  accountAddress,
  marketId,
  loanRepayAmount,
  maxSlippageTolerance,
}: PrepareMarketRepayWithCollateralActionParameters): Promise<PrepareMarketRepayWithCollateralActionReturnType> {
  const { paraswapAdapter: paraswapAdapterAddress, generalAdapter1: generalAdapter1Address } = bundler3Addresses;
  if (!paraswapAdapterAddress) {
    return {
      status: "error",
      message: "Repay with collateral not supported (missing adapter).",
    };
  }

  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "market-repay-withdraw-collateral",
      accountAddress,
      marketId,
      publicClient,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const market = simulationState.getMarket(marketId);
  const accountPosition = simulationState.getPosition(accountAddress, marketId);

  const positionCollateralBefore = accountPosition.collateral;
  const positionLoanBefore = market.toBorrowAssets(accountPosition.borrowShares);
  const positionLtvBefore = market.getLtv(accountPosition) ?? BigInt(0);

  if (!market.price) {
    return {
      status: "error",
      message: "Oracle issue: missing price.",
    };
  }

  const { collateralToken: collateralTokenAddress, loanToken: loanTokenAddress } = market.params;

  const closingPosition = loanRepayAmount == maxUint256;

  let loanSwapAmount: bigint;
  if (closingPosition) {
    // Include a margin to account for accured interest between now and execution
    // Actual swap will adjust to use true loan amount, but this get's us a maxCollateralSwapAmount needed and is used for quote (upper bound)
    loanSwapAmount = (positionLoanBefore * REBASEING_MARGIN) / BigInt(FACTOR_SCALE);
  } else {
    loanSwapAmount = loanRepayAmount;
  }

  // Worst case required collateral amount
  const slippageMultiplier = 1 / (1 - maxSlippageTolerance); // This is guarentted to be >1
  const loanSwapAmountWithSlippage =
    (loanSwapAmount * BigInt(Math.floor(slippageMultiplier * FACTOR_SCALE))) / BigInt(FACTOR_SCALE);
  const maxCollateralSwapAmount = MathLib.mulDivDown(loanSwapAmountWithSlippage, ORACLE_PRICE_SCALE, market.price);

  if (maxCollateralSwapAmount > positionCollateralBefore) {
    return {
      status: "error",
      message: "Insufficient collateral with worst case slippage.",
    };
  }

  let paraswapQuote: GetParaswapReturnType;
  try {
    // Exact buy of loan assets
    paraswapQuote = await getParaswapExactBuy({
      publicClient: publicClient,
      accountAddress: paraswapAdapterAddress, // User is the paraswap adapter
      srcTokenAddress: collateralTokenAddress,
      destTokenAddress: loanTokenAddress,
      maxSrcTokenAmount: maxCollateralSwapAmount,
      exactDestTokenAmount: loanSwapAmount,
    });
  } catch (e) {
    trackEvent("paraswap-error", { error: e instanceof Error ? e.message : JSON.stringify(e) });
    return {
      status: "error",
      message: `Swap Error: Unable to get quote.`,
    };
  }

  // Override simulation state for actions not supported by the simulation SDK
  if (closingPosition) {
    accountPosition.borrowShares = BigInt(0);
  } else {
    accountPosition.borrowShares -= market.toBorrowShares(loanSwapAmount);
  }

  // Use subBundle here to so that it handles any required requirement's
  let collateralWithdrawSubBundleEncoded: ActionBundle;
  try {
    const collateralWithdrawSubBundle = populateSubBundle(
      {
        type: "Blue_WithdrawCollateral",
        sender: accountAddress,
        address: morphoBlueAddress,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          receiver: paraswapAdapterAddress,
          assets: closingPosition ? accountPosition.collateral : maxCollateralSwapAmount, // Full collateral withdraw if closing position - bundler SDK has issues with maxUint256, but this works the same
        },
      },
      simulationState,
      {
        publicAllocatorOptions: {
          enabled: true,
        },
      }
    );

    collateralWithdrawSubBundleEncoded = encodeBundle(collateralWithdrawSubBundle, simulationState, !isSmartAccount);
  } catch (e) {
    console.log("ERROR", e);
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }

  const maxSharePriceE27 = market.toSupplyShares(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

  function getBundleTx() {
    const encodedWithdrawCollateralBundlerCalls = collateralWithdrawSubBundleEncoded.actions.map((action) =>
      BundlerAction.encode(CHAIN_ID, action)
    );

    const bundlerCalls: BundlerCall[] = [
      // Repay loan
      BundlerAction.morphoRepay(
        CHAIN_ID,
        market.params,
        closingPosition ? BigInt(0) : loanRepayAmount,
        closingPosition ? maxUint256 : BigInt(0), // Full repay when closing position
        maxSharePriceE27,
        accountAddress,
        // Repay loan callbacks, all actions will happen before Morpho pulls the required loan assets from GA1 (i.e must have required loan assets in GA1 at the end of these callbacks)
        [
          // Withdraw max required collateral to Paraswap adapter
          ...encodedWithdrawCollateralBundlerCalls,
          // Swap collateral to the exact amount of loan assets, sending to GA1
          // Note that we can't use paraswapBuyDebt here since we don't have any remaining debt (already called morphoRepay)
          paraswapBuy(
            paraswapQuote.augustus,
            paraswapQuote.calldata,
            collateralTokenAddress,
            loanTokenAddress,
            paraswapQuote.offsets,
            generalAdapter1Address
          ),
          // Sweep any leftover collateral assets from paraswap adapter to GA1
          BundlerAction.erc20Transfer(
            CHAIN_ID,
            collateralTokenAddress,
            generalAdapter1Address,
            maxUint256,
            paraswapAdapterAddress
          ),
        ].flat()
      ),
      // Loan assets will be withdrawn from GA1 here to complete the repay

      ...(closingPosition
        ? [
            // Sweep any leftover collateral assets from GA1 to user
            BundlerAction.erc20Transfer(CHAIN_ID, collateralTokenAddress, accountAddress, maxUint256),
            // Sweep any leftover loan assets from GA1 to user
            BundlerAction.erc20Transfer(CHAIN_ID, loanTokenAddress, accountAddress, maxUint256),
          ]
        : [
            // Add back to position if it's not being closed
            morphoSupplyCollateral(CHAIN_ID, market.params, maxUint256, accountAddress, [], true),
            // There won't be any loan assets leftover since we did an exact buy for partial positions
          ]),
    ].flat();

    return createBundle(bundlerCalls);
  }

  const simulationStateAfter =
    collateralWithdrawSubBundleEncoded.steps?.[collateralWithdrawSubBundleEncoded.steps.length - 1];
  const marketAfter = simulationStateAfter?.getMarket(marketId);
  const userPositionAfter = simulationStateAfter?.getPosition(accountAddress, marketId);

  return {
    status: "success",
    signatureRequests: collateralWithdrawSubBundleEncoded.requirements.signatures.map((sig) => ({
      sign: sig.sign,
      name: getSignatureRequirementDescription(sig, simulationState),
    })),
    transactionRequests: [
      ...collateralWithdrawSubBundleEncoded.requirements.txs.map((tx) => ({
        tx: () => tx.tx,
        name: getTransactionRequirementDescription(tx, simulationState),
      })),
      {
        name: "Confirm Repay",
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
