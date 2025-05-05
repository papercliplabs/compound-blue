import { getSimulationState } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { prepareBundle, PrepareMorphoActionReturnType, SimulatedValueChange } from "./helpers";
import { Address, Client, maxUint256 } from "viem";
import { getIsContract } from "@/data/getIsContract";

interface PrepareVaultWithdrawActionParameters {
  publicClient: Client;
  vaultAddress: Address;
  accountAddress: Address;
  withdrawAmount: bigint; // Max uint256 for entire position balanace
}

export type PrepareVaultWithdrawActionReturnType =
  | (Omit<
      Extract<PrepareMorphoActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareMorphoActionReturnType, { status: "error" }>;

export async function prepareVaultWithdrawBundle({
  publicClient,
  vaultAddress,
  accountAddress,
  withdrawAmount,
}: PrepareVaultWithdrawActionParameters): Promise<PrepareVaultWithdrawActionReturnType> {
  if (withdrawAmount <= 0n) {
    return {
      status: "error",
      message: "Withdraw amount must be greater than 0.",
    };
  }

  const [simulationState, isContract] = await Promise.all([
    getSimulationState({
      actionType: "vault",
      accountAddress,
      vaultAddress,
      publicClient,
    }),
    getIsContract(publicClient, accountAddress),
  ]);

  const userShareBalance = simulationState.getHolding(accountAddress, vaultAddress).balance;
  const isMaxWithdraw = withdrawAmount == maxUint256;

  const preparedAction = prepareBundle(
    [
      {
        type: "MetaMorpho_Withdraw",
        sender: accountAddress,
        address: vaultAddress,
        args: {
          // Use shares if a max withdraw to prevent dust
          ...(isMaxWithdraw ? { shares: userShareBalance } : { assets: withdrawAmount }),
          owner: accountAddress,
          receiver: accountAddress,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
    ],
    accountAddress,
    isContract,
    simulationState,
    "Confirm Withdraw"
  );

  if (preparedAction.status == "success") {
    return {
      ...preparedAction,
      positionBalanceChange: {
        before: preparedAction.initialSimulationState.getHolding(accountAddress, vaultAddress).balance,
        after: preparedAction.finalSimulationState.getHolding(accountAddress, vaultAddress).balance,
      },
    };
  } else {
    return preparedAction;
  }
}
