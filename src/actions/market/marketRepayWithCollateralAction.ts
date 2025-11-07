import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId, MathLib, ORACLE_PRICE_SCALE } from "@morpho-org/blue-sdk";
import { BundlerAction, BundlerCall, encodeBundle, populateSubBundle } from "@morpho-org/bundler-sdk-viem";
import { Address, Client, maxUint256 } from "viem";

import { getParaswapExactBuyTxPayload } from "@/actions/data/paraswap/getParaswapExactBuy";
import { getIsContract } from "@/actions/data/rpc/getIsContract";
import { getSimulationState } from "@/actions/data/rpc/getSimulationState";
import { CHAIN_ID, MAX_SLIPPAGE_TOLERANCE_LIMIT } from "@/config";
import { GENERAL_ADAPTER_1_ADDRESS, MORPHO_BLUE_ADDRESS, PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";

import { getTransactionRequirementDescription } from "../subbundles/subbundleFromInputOps";
import { getSignatureRequirementDescription } from "../subbundles/subbundleFromInputOps";
import { createBundle, paraswapBuy } from "../utils/bundlerActions";
import { computeAmountWithRebasingMargin, computeAmountWithSlippageSurplus } from "../utils/math";
import { SimulatedValueChange } from "../utils/positionChange";
import { Action } from "../utils/types";

interface MarketRepayWithCollateralActionParameters {
  publicClient: Client;
  marketId: MarketId;
  accountAddress: Address;
  loanRepayAmount: bigint; // max uint256 for entire position
  maxSlippageTolerance: number; // (0,MAX_SLIPPAGE_TOLERANCE_LIMIT)
}

export type MarketRepayWithCollateralAction =
  | (Omit<Extract<Action, { status: "success" }>, "initialSimulationState" | "finalSimulationState"> & {
      positionCollateralChange: SimulatedValueChange<bigint>;
      positionLoanChange: SimulatedValueChange<bigint>;
      positionLtvChange: SimulatedValueChange<bigint>;
    })
  | Extract<Action, { status: "error" }>;

export async function marketRepayWithCollateralAction({
  publicClient,
  marketId,
  accountAddress,
  loanRepayAmount,
  maxSlippageTolerance,
}: MarketRepayWithCollateralActionParameters): Promise<MarketRepayWithCollateralAction> {
  if (loanRepayAmount <= 0n) {
    return {
      status: "error",
      message: `Loan repay amount must be greater than 0.`,
    };
  }
  if (maxSlippageTolerance <= 0 || maxSlippageTolerance > MAX_SLIPPAGE_TOLERANCE_LIMIT) {
    return {
      status: "error",
      message: `Slippage tolerance must between 0 and ${MAX_SLIPPAGE_TOLERANCE_LIMIT}.`,
    };
  }

  const [simulationState, isContract] = await Promise.all([
    getSimulationState({
      actionType: "market",
      accountAddress,
      marketId,
      publicClient,
      requiresPublicReallocation: false,
    }),
    getIsContract(publicClient, accountAddress),
  ]);

  const market = simulationState.getMarket(marketId);
  const accountPosition = simulationState.getPosition(accountAddress, marketId);

  const accountPositionInitialBorrowShares = accountPosition.borrowShares;

  const positionCollateralBefore = accountPosition.collateral;
  const positionLoanBefore = market.toBorrowAssets(accountPosition.borrowShares);
  const positionLtvBefore = market.getLtv(accountPosition) ?? 0n;

  if (market.price == undefined || market.price == 0n) {
    return {
      status: "error",
      message: "Missing oracle price.",
    };
  }

  const { collateralToken: collateralTokenAddress, loanToken: loanTokenAddress } = market.params;

  const closingPosition = loanRepayAmount == maxUint256;

  // Include a margin to account for accrued interest between now and execution if closing
  const loanSwapAmount = closingPosition ? computeAmountWithRebasingMargin(positionLoanBefore) : loanRepayAmount;

  // Worst case required collateral amount
  const quoteCollateralAmount = MathLib.mulDivUp(loanSwapAmount, ORACLE_PRICE_SCALE, market.price);
  const maxCollateralSwapAmount = computeAmountWithSlippageSurplus(quoteCollateralAmount, maxSlippageTolerance);

  // Need to move worst case collateral into adapter, so must exist
  if (maxCollateralSwapAmount > positionCollateralBefore) {
    return {
      status: "error",
      message: "Insufficient collateral for worst case slippage.",
    };
  }

  try {
    const { assets: repaidAssets, shares: repaidShares } = market.repay(
      closingPosition ? 0n : loanRepayAmount,
      closingPosition ? accountPosition.borrowShares : 0n
    );
    const maxSharePriceE27 = MathLib.mulDivUp(
      repaidAssets,
      MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE),
      repaidShares
    );

    // Exact buy of loan assets
    const paraswapQuote = await getParaswapExactBuyTxPayload({
      publicClient: publicClient,
      accountAddress: PARASWAP_ADAPTER_ADDRESS, // User is the paraswap adapter
      srcTokenAddress: collateralTokenAddress,
      destTokenAddress: loanTokenAddress,
      slippageType: "max-input",
      maxSrcTokenAmount: maxCollateralSwapAmount,
      exactDestTokenAmount: loanSwapAmount,
    });

    // Override simulation state for actions not supported by the simulation SDK
    if (closingPosition) {
      accountPosition.borrowShares = 0n;
    } else {
      accountPosition.borrowShares -= market.toBorrowShares(loanSwapAmount);
    }

    const collateralWithdrawSubBundle = populateSubBundle(
      {
        type: "Blue_WithdrawCollateral",
        sender: accountAddress,
        address: MORPHO_BLUE_ADDRESS,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          receiver: PARASWAP_ADAPTER_ADDRESS,
          assets: closingPosition ? accountPosition.collateral : maxCollateralSwapAmount, // Full collateral withdraw if closing position - bundler SDK has issues with maxUint256, but this works the same
        },
      },
      simulationState
    );

    const collateralWithdrawSubBundleEncoded = encodeBundle(collateralWithdrawSubBundle, simulationState, !isContract);

    function getBundleTx() {
      const encodedWithdrawCollateralBundlerCalls = collateralWithdrawSubBundleEncoded.actions.map((action) =>
        BundlerAction.encode(CHAIN_ID, action)
      );

      const bundlerCalls: BundlerCall[] = [
        // Repay loan
        BundlerAction.morphoRepay(
          CHAIN_ID,
          market.params,
          closingPosition ? 0n : loanRepayAmount, // Assets
          closingPosition ? accountPositionInitialBorrowShares : 0n, // Shares - full repay using shares when closing position
          maxSharePriceE27,
          accountAddress,
          // Repay loan callbacks, all actions will happen before Morpho pulls the required loan assets from GA1 (i.e must have required loan assets in GA1 at the end of these callbacks)
          [
            // Withdraw max required collateral to Paraswap adapter
            ...encodedWithdrawCollateralBundlerCalls,
            // Swap collateral to the "exact" (can have surplus) amount of loan assets, sending to GA1
            // Note that we can't use paraswapBuyDebt here since we don't have any remaining debt (already called morphoRepay)
            paraswapBuy(
              paraswapQuote.augustus,
              paraswapQuote.calldata,
              collateralTokenAddress,
              loanTokenAddress,
              paraswapQuote.offsets,
              GENERAL_ADAPTER_1_ADDRESS
            ),
            // Sweep any leftover collateral assets from paraswap adapter to GA1 - exact out, so no leftover loan assets from swap
            BundlerAction.erc20Transfer(
              collateralTokenAddress,
              GENERAL_ADAPTER_1_ADDRESS,
              maxUint256,
              PARASWAP_ADAPTER_ADDRESS
            ),
          ].flat()
        ),
        // Loan assets will be withdrawn from GA1 here to complete the repay

        // Sweep any leftover loan assets from GA1 to user. Leftover occurs when there is dust from the rebasing margin from closing position, and from swap surplus
        BundlerAction.erc20Transfer(loanTokenAddress, accountAddress, maxUint256, GENERAL_ADAPTER_1_ADDRESS),

        ...(closingPosition
          ? [
              // Sweep any leftover collateral assets from GA1 to user
              BundlerAction.erc20Transfer(
                collateralTokenAddress,
                accountAddress,
                maxUint256,
                GENERAL_ADAPTER_1_ADDRESS
              ),
            ]
          : [
              // Add back to position if it's not being closed
              // Allow this to revert since it will do so if there are no collateral assets to sweep which occurs if the swap consumes full slippage tolerance
              BundlerAction.morphoSupplyCollateral(CHAIN_ID, market.params, maxUint256, accountAddress, [], true),
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
      // TODO: can clean up by getting sim state before and after and use the helper to compute this change
      positionCollateralChange: {
        before: positionCollateralBefore,
        after: userPositionAfter?.collateral ?? 0n,
        delta: (userPositionAfter?.collateral ?? 0n) - positionCollateralBefore,
      },
      positionLoanChange: {
        before: positionLoanBefore,
        after: marketAfter?.toBorrowAssets(userPositionAfter?.borrowShares ?? 0n) ?? 0n,
        delta: (marketAfter?.toBorrowAssets(userPositionAfter?.borrowShares ?? 0n) ?? 0n) - positionLoanBefore,
      },
      positionLtvChange: {
        before: positionLtvBefore,
        after: marketAfter?.getLtv(userPositionAfter ?? { collateral: 0n, borrowShares: 0n }) ?? 0n,
        delta:
          (marketAfter?.getLtv(userPositionAfter ?? { collateral: 0n, borrowShares: 0n }) ?? 0n) - positionLtvBefore,
      },
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
