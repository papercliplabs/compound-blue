import { getSimulationState } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { prepareBundle, PrepareMorphoActionReturnType, SimulatedValueChange } from "./helpers";
import { Address, Client, maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";

interface PrepareVaultSupplyActionParameters {
  publicClient: Client;
  accountAddress: Address;
  vaultAddress: Address;
  supplyAmount: bigint; // Max uint256 for entire account balanace
}

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
}: PrepareVaultSupplyActionParameters): Promise<PrepareVaultSupplyActionReturnType> {
  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "vault",
      accountAddress,
      vaultAddress,
      publicClient,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const vault = simulationState.getVault(vaultAddress);
  const userAssetBalance = simulationState.getHolding(accountAddress, vault.asset).balance;
  if (supplyAmount == maxUint256) {
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
    const positionBalanceBefore = preparedAction.initialSimulationState.getHolding(
      accountAddress,
      vaultAddress
    ).balance;
    const positionBalanceAfter = preparedAction.finalSimulationState.getHolding(accountAddress, vaultAddress).balance;

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
