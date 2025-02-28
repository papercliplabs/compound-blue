import { getSimulationState, GetSimulationStateVaultSupplyParameters } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType, prepareBundle } from "./helpers";

type PrepareVaultSupplyActionParameters = Omit<GetSimulationStateVaultSupplyParameters, "actionType"> & {
  supplyAmount: bigint;
};

// TODO: parse and return error
export async function prepareVaultSupplyBundle({
  supplyAmount,
  accountAddress,
  vaultAddress,
  ...params
}: PrepareVaultSupplyActionParameters): Promise<PrepareActionReturnType> {
  const simulationState = await getSimulationState({
    actionType: "vault-supply",
    accountAddress,
    vaultAddress,
    ...params,
  });

  return prepareBundle(
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
}
