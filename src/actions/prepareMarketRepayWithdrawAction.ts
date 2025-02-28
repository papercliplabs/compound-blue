import { getSimulationState, GetSimulationStateMarketRepayWithdrawParameters } from "@/data/getSimulationState";
import { addresses, DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType, prepareBundle } from "./helpers";
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

// TODO: enable the public allocator here!!!
export async function prepareMarketRepayWithdrawAction({
  repayAmount,
  withdrawCollateralAmount,
  accountAddress,
  marketId,
  ...params
}: PrepareMarketRepayWithdrawActionParameters): Promise<PrepareActionReturnType> {
  const simulationState = await getSimulationState({
    actionType: "market-repay-withdraw",
    accountAddress,
    marketId,
    ...params,
  });

  const isRepay = repayAmount > BigInt(0);
  const isWithdraw = repayAmount > BigInt(0);

  return prepareBundle(
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
}
