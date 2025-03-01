import { getSimulationState, GetSimulationStateVaultSupplyParameters } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType, prepareBundle, SimulatedValueChange } from "./helpers";

type PrepareVaultWithdrawBundleParameters = Omit<GetSimulationStateVaultSupplyParameters, "actionType"> & {
  withdrawAmount: bigint;
};

export type PrepareVaultWithdrawActionReturnType =
  | (Omit<
      Extract<PrepareActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareActionReturnType, { status: "error" }>;

export async function prepareVaultWithdrawBundle({
  withdrawAmount,
  accountAddress,
  vaultAddress,
  ...params
}: PrepareVaultWithdrawBundleParameters): Promise<PrepareVaultWithdrawActionReturnType> {
  const simulationState = await getSimulationState({
    actionType: "vault-withdraw",
    accountAddress,
    vaultAddress,
    ...params,
  });

  const preparedAction = prepareBundle(
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
