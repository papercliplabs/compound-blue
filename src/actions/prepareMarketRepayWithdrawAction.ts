import { getSimulationState, GetSimulationStateMarketRepayWithdrawParameters } from "@/data/getSimulationState";
import { addresses, DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType, prepareBundle, SimulatedValueChange } from "./helpers";
import { CHAIN_ID } from "@/config";
import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";

const { morpho } = addresses[CHAIN_ID];

type PrepareMarketRepayWithdrawActionParameters = Omit<
  GetSimulationStateMarketRepayWithdrawParameters,
  "actionType"
> & {
  repayAmount: bigint;
  withdrawCollateralAmount: bigint;
};

export type PrepareMarketRepayWithdrawActionReturnType =
  | (Omit<
      Extract<PrepareActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionCollateralChange: SimulatedValueChange<bigint>;
      positionLoanChange: SimulatedValueChange<bigint>;
      positionLtvChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareActionReturnType, { status: "error" }>;

// TODO: enable the public allocator here!!!
export async function prepareMarketRepayWithdrawAction({
  repayAmount,
  withdrawCollateralAmount,
  accountAddress,
  marketId,
  ...params
}: PrepareMarketRepayWithdrawActionParameters): Promise<PrepareMarketRepayWithdrawActionReturnType> {
  const simulationState = await getSimulationState({
    actionType: "market-repay-withdraw",
    accountAddress,
    marketId,
    ...params,
  });

  const isRepay = repayAmount > BigInt(0);
  const isWithdraw = withdrawCollateralAmount > BigInt(0);

  const preparedAction = prepareBundle(
    [
      // TODO: handle a full repay here also (use shares instead if full)...
      // Bunler SDK might already do this if we specify shares here (convert to assets, transfer more than needed, and then sweep remaining back after)
      ...(isRepay
        ? [
            {
              type: "Blue_Repay",
              sender: accountAddress,
              address: morpho,
              args: {
                id: marketId,
                onBehalf: accountAddress,
                assets: repayAmount,
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
      marketBefore?.getLtv({
        collateral: positionCollateralBefore,
        borrowShares: positionBefore?.borrowShares ?? BigInt(0),
      }) ?? BigInt(0);
    const ltvAfter =
      marketAfter?.getLtv({
        collateral: positionCollateralAfter,
        borrowShares: positionAfter?.borrowShares ?? BigInt(0),
      }) ?? BigInt(0);

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
