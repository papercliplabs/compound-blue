import { GetSimuationStateMarketSupplyBorrowParameters, getSimulationState } from "@/data/getSimulationState";
import { addresses, DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType, prepareBundle } from "./helpers";
import { CHAIN_ID } from "@/config";

const { morpho } = addresses[CHAIN_ID];

type PrepareMarketSupplyBorrowActionParameters = Omit<GetSimuationStateMarketSupplyBorrowParameters, "actionType"> & {
  supplyCollateralAmount: bigint; // collateral
  borrowAmount: bigint;
};

// TODO: enable the public allocator here!!!
export async function prepareMarketSupplyBorrowAction({
  supplyCollateralAmount,
  borrowAmount,
  accountAddress,
  marketId,
  ...params
}: PrepareMarketSupplyBorrowActionParameters): Promise<PrepareActionReturnType> {
  const simulationState = await getSimulationState({
    actionType: "market-supply-borrow",
    accountAddress,
    marketId,
    ...params,
  });

  const isSupply = supplyCollateralAmount > BigInt(0);
  const isBorrow = borrowAmount > BigInt(0);

  return prepareBundle(
    [
      {
        type: "Blue_SupplyCollateral",
        sender: accountAddress,
        address: morpho,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          assets: supplyCollateralAmount,
        },
      },
      // TODO: currently a bug in morpho bundler SDK
      {
        type: "Blue_Borrow",
        sender: accountAddress,
        address: morpho,
        args: {
          id: marketId,
          onBehalf: accountAddress,
          receiver: accountAddress,
          assets: borrowAmount,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
    ],
    accountAddress,
    simulationState,
    `Confirm ${isSupply ? "Supply" : ""}${isSupply && isBorrow ? " & " : ""}${isBorrow ? "Borrow" : ""}`
  );
}
