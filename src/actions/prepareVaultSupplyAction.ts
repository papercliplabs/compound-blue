import { getSimulationState, GetSimulationStateVaultSupplyParameters } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { prepareBundle, PrepareMorphoActionReturnType, SimulatedValueChange } from "./helpers";
import { maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";

type PrepareVaultSupplyActionParameters = Omit<GetSimulationStateVaultSupplyParameters, "actionType"> & {
  supplyAmount: bigint; // Max uint256 for entire account balanace
};

export type PrepareVaultSupplyActionReturnType =
  | (Omit<
      Extract<PrepareMorphoActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareMorphoActionReturnType, { status: "error" }>;

export async function prepareVaultSupplyBundle({
  supplyAmount,
  accountAddress,
  vaultAddress,
  publicClient,
  ...params
}: PrepareVaultSupplyActionParameters): Promise<PrepareVaultSupplyActionReturnType> {
  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "vault-supply",
      accountAddress,
      vaultAddress,
      publicClient,
      ...params,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const vault = simulationState.vaults?.[vaultAddress];
  const userAssetBalance = simulationState.holdings?.[accountAddress]?.[vault?.asset ?? "0x"]?.balance;
  if (supplyAmount == maxUint256) {
    if (!userAssetBalance) {
      // Won't happen, we need this to have a correct simulation anyways
      return {
        status: "error",
        message: "Pre simulation error: Missing user asset balance for max supply.",
      };
    }
    supplyAmount = userAssetBalance;
  }

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
    isSmartAccount,
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
