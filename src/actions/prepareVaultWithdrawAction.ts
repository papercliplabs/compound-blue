import { getSimulationState } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { prepareBundle, PrepareMorphoActionReturnType, SimulatedValueChange } from "./helpers";
import { Address, Client, maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";

interface PrepareVaultWithdrawActionParameters {
  publicClient: Client;
  accountAddress: Address;
  vaultAddress: Address;
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
  withdrawAmount,
  accountAddress,
  vaultAddress,
  publicClient,
  ...params
}: PrepareVaultWithdrawActionParameters): Promise<PrepareVaultWithdrawActionReturnType> {
  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "vault",
      accountAddress,
      vaultAddress,
      publicClient,
      ...params,
    }),
    getIsSmartAccount(publicClient, accountAddress),
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
          // Use shares if a max withdraw to prevent dust, ideally would use maxUint256, but SDK has issue
          ...(isMaxWithdraw ? { shares: userShareBalance! } : { assets: withdrawAmount }),
          owner: accountAddress,
          receiver: accountAddress,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
    ],
    accountAddress,
    isSmartAccount,
    simulationState,
    "Confirm Withdraw"
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
