import { getSimulationState, GetSimulationStateMarketRepayWithdrawParameters } from "@/data/getSimulationState";
import { addresses, DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { prepareBundle, PrepareMorphoActionReturnType, SimulatedValueChange } from "./helpers";
import { CHAIN_ID } from "@/config";
import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";
import { maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";

const { morpho } = addresses[CHAIN_ID];

type PrepareMarketRepayWithdrawCollateralActionParameters = Omit<
  GetSimulationStateMarketRepayWithdrawParameters,
  "actionType"
> & {
  repayAmount: bigint; // Max uint256 for entire position balance
  withdrawCollateralAmount: bigint; // Max uint256 for entire position collateral balance
};

export type PrepareMarketRepayWithdrawCollateralActionReturnType =
  | (Omit<
      Extract<PrepareMorphoActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionCollateralChange: SimulatedValueChange<bigint>;
      positionLoanChange: SimulatedValueChange<bigint>;
      positionLtvChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareMorphoActionReturnType, { status: "error" }>;

export async function prepareMarketRepayWithdrawCollateralAction({
  repayAmount,
  withdrawCollateralAmount,
  accountAddress,
  marketId,
  publicClient,
  ...params
}: PrepareMarketRepayWithdrawCollateralActionParameters): Promise<PrepareMarketRepayWithdrawCollateralActionReturnType> {
  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "market-repay-withdraw-collateral",
      accountAddress,
      marketId,
      publicClient,
      ...params,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const isMaxRepay = repayAmount == maxUint256;
  const isMaxWithdrawCollateral = withdrawCollateralAmount == maxUint256;

  const userPosition = simulationState.positions?.[accountAddress]?.[marketId];
  if ((isMaxRepay || isMaxWithdrawCollateral) && !userPosition) {
    return {
      status: "error",
      message: "Pre simulation error: Missing user position.",
    };
  }

  if (isMaxWithdrawCollateral) {
    withdrawCollateralAmount = userPosition!.collateral;
  }

  const isRepay = repayAmount > BigInt(0);
  const isWithdraw = withdrawCollateralAmount > BigInt(0);

  const preparedAction = prepareBundle(
    [
      ...(isRepay
        ? [
            {
              type: "Blue_Repay",
              sender: accountAddress,
              address: morpho,
              args: {
                id: marketId,
                onBehalf: accountAddress,
                // Use shares if a max repay to ensure fully closed position
                ...(isMaxRepay ? { shares: userPosition!.borrowShares } : { assets: repayAmount }),
                slippage: DEFAULT_SLIPPAGE_TOLERANCE,
              },
            } as InputBundlerOperation,
          ]
        : []),
      ...(isWithdraw
        ? [
            {
              type: "Blue_WithdrawCollateral",
              sender: accountAddress,
              address: morpho,
              args: {
                id: marketId,
                onBehalf: accountAddress,
                receiver: accountAddress,
                assets: withdrawCollateralAmount,
              },
            } as InputBundlerOperation,
          ]
        : []),
    ],
    accountAddress,
    isSmartAccount,
    simulationState,
    `Confirm ${isRepay ? "Repay" : ""}${isRepay && isWithdraw ? " & " : ""}${isWithdraw ? "Withdraw" : ""}`
  );

  if (preparedAction.status == "success") {
    const positionBefore = preparedAction.initialSimulationState.positions?.[accountAddress]?.[marketId];
    const positionAfter = preparedAction.finalSimulationState.positions?.[accountAddress]?.[marketId];
    const marketBefore = preparedAction.initialSimulationState.markets?.[marketId];
    const marketAfter = preparedAction.finalSimulationState.markets?.[marketId];

    const positionCollateralBefore = positionBefore?.collateral ?? BigInt(0);
    const positionCollateralAfter = positionAfter?.collateral ?? BigInt(0);

    const positionLoanBefore = marketBefore?.toBorrowAssets(positionBefore?.borrowShares ?? BigInt(0)) ?? BigInt(0);
    const positionLoanAfter = marketAfter?.toBorrowAssets(positionAfter?.borrowShares ?? BigInt(0)) ?? BigInt(0);

    const ltvBefore =
      positionBefore?.borrowShares == BigInt(0)
        ? BigInt(0)
        : (marketBefore?.getLtv({
            collateral: positionCollateralBefore,
            borrowShares: positionBefore?.borrowShares ?? BigInt(0),
          }) ?? BigInt(0));
    const ltvAfter =
      positionAfter?.borrowShares == BigInt(0)
        ? BigInt(0)
        : (marketAfter?.getLtv({
            collateral: positionCollateralAfter,
            borrowShares: positionAfter?.borrowShares ?? BigInt(0),
          }) ?? BigInt(0));

    return {
      ...preparedAction,
      positionCollateralChange: {
        before: positionCollateralBefore,
        after: positionCollateralAfter,
      },
      positionLoanChange: {
        before: positionLoanBefore,
        after: positionLoanAfter,
      },
      positionLtvChange: {
        before: ltvBefore,
        after: ltvAfter,
      },
    };
  } else {
    return preparedAction;
  }
}
