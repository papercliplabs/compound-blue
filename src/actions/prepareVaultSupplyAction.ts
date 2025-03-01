import { getSimulationState, GetSimulationStateVaultSupplyParameters } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType, prepareBundle, SimulatedValueChange } from "./helpers";

type PrepareVaultSupplyActionParameters = Omit<GetSimulationStateVaultSupplyParameters, "actionType"> & {
  supplyAmount: bigint;
};

export type PrepareVaultSupplyActionReturnType =
  | (Omit<
      Extract<PrepareActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareActionReturnType, { status: "error" }>;

export async function prepareVaultSupplyBundle({
  supplyAmount,
  accountAddress,
  vaultAddress,
  ...params
}: PrepareVaultSupplyActionParameters): Promise<PrepareVaultSupplyActionReturnType> {
  const simulationState = await getSimulationState({
    actionType: "vault-supply",
    accountAddress,
    vaultAddress,
    ...params,
  });

  const preparedAction = prepareBundle(
    [
      {
        type: "MetaMorpho_Deposit",
        sender: accountAddress,
        address: vaultAddress,
        args: {
          assets: supplyAmount,
          owner: accountAddress,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
    ],
    accountAddress,
    simulationState,
    "Confirm Supply"
  );

  if (preparedAction.status == "success") {
    const positionBalanceBefore =
      preparedAction.initialSimulationState.holdings?.[accountAddress]?.[vaultAddress]?.balance ?? BigInt(0);
    const positionBalanceAfter =
      preparedAction.finalSimulationState.holdings?.[accountAddress]?.[vaultAddress]?.balance ?? BigInt(0);

    return {
      ...preparedAction,
      positionBalanceChange: {
        before: positionBalanceBefore,
        after: positionBalanceAfter,
      },
    };
  } else {
    return preparedAction;
  }
}
