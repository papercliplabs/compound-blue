import { getSimulationState, GetSimulationStateVaultSupplyParameters } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType, prepareBundle } from "./helpers";

type PrepareVaultWithdrawBundleParameters = Omit<GetSimulationStateVaultSupplyParameters, "actionType"> & {
  withdrawAmount: bigint;
};

export async function prepareVaultWithdrawBundle({
  withdrawAmount,
  accountAddress,
  vaultAddress,
  ...params
}: PrepareVaultWithdrawBundleParameters): Promise<PrepareActionReturnType> {
  const simulationState = await getSimulationState({
    actionType: "vault-withdraw",
    accountAddress,
    vaultAddress,
    ...params,
  });

  return prepareBundle(
    [
      {
        type: "MetaMorpho_Withdraw",
        sender: accountAddress,
        address: vaultAddress,
        args: {
          assets: withdrawAmount,
          owner: accountAddress,
          receiver: accountAddress,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
    ],
    accountAddress,
    simulationState,
    "Confirm Withdraw"
  );
}
