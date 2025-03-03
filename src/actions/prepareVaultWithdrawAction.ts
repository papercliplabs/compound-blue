import { getSimulationState, GetSimulationStateVaultSupplyParameters } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { prepareBundle, PrepareMorphoActionReturnType, SimulatedValueChange } from "./helpers";
import { maxUint256 } from "viem";

type PrepareVaultWithdrawBundleParameters = Omit<GetSimulationStateVaultSupplyParameters, "actionType"> & {
  withdrawAmount: bigint; // Max uint256 for entire position balanace
};

export type PrepareVaultWithdrawActionReturnType =
  | (Omit<
      Extract<PrepareMorphoActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareMorphoActionReturnType, { status: "error" }>;

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

  const userShareBalance = simulationState.holdings?.[accountAddress]?.[vaultAddress]?.balance;
  const isMaxWithdraw = withdrawAmount == maxUint256;
  if (isMaxWithdraw && !userShareBalance) {
    // Won't happen, we need this to have a correct simulation anyways
    return {
      status: "error",
      message: "Pre simulation error: Missing user share balance for max withdraw.",
    };
  }

  const preparedAction = prepareBundle(
    [
      {
        type: "MetaMorpho_Withdraw",
        sender: accountAddress,
        address: vaultAddress,
        args: {
          // Use shares if a max withdraw to prevent dust
          ...(isMaxWithdraw ? { shares: userShareBalance! } : { assets: withdrawAmount }),
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
