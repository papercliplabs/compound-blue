import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { Address, Client, maxUint256 } from "viem";

import { getIsContract } from "@/actions/data/rpc/getIsContract";
import { getSimulationState } from "@/actions/data/rpc/getSimulationState";

import { SimulatedValueChange } from "../utils/positionChange";
import { MorphoAction, prepareBundle } from "../utils/prepareBundle";

interface VaultWithdrawActionParameters {
  publicClient: Client;
  vaultAddress: Address;
  accountAddress: Address;
  withdrawAmount: bigint; // Max uint256 for entire position balanace
}

export type VaultWithdrawAction =
  | (Omit<Extract<MorphoAction, { status: "success" }>, "initialSimulationState" | "finalSimulationState"> & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<MorphoAction, { status: "error" }>;

export async function vaultWithdrawAction({
  publicClient,
  vaultAddress,
  accountAddress,
  withdrawAmount,
}: VaultWithdrawActionParameters): Promise<VaultWithdrawAction> {
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
        delta:
          (preparedAction.finalSimulationState.getHolding(accountAddress, vaultAddress).balance ?? 0n) -
          preparedAction.initialSimulationState.getHolding(accountAddress, vaultAddress).balance,
      },
    };
  } else {
    return preparedAction;
  }
}
