import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { Address, Client, maxUint256 } from "viem";

import { getIsContract } from "@/actions/data/rpc/getIsContract";
import { getSimulationState } from "@/actions/data/rpc/getSimulationState";
import { GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";

import { inputTransferSubbundle } from "../subbundles/inputTransferSubbundle";
import { subbundleFromInputOps } from "../subbundles/subbundleFromInputOps";
import { SimulatedValueChange } from "../utils/positionChange";
import { subbundlesToAction } from "../utils/subbundlesToAction";
import { Action } from "../utils/types";

interface VaultSupplyActionParameters {
  publicClient: Client;
  vaultAddress: Address;
  accountAddress: Address;
  supplyAmount: bigint; // Max uint256 for entire account balanace
  allowWrappingNativeAssets: boolean; // Ignored if the vault asset is not wrapped native
}

export type VaultSupplyAction =
  | (Extract<Action, { status: "success" }> & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<Action, { status: "error" }>;

export async function vaultSupplyBundle({
  publicClient,
  vaultAddress,
  accountAddress,
  supplyAmount,
  allowWrappingNativeAssets = false,
}: VaultSupplyActionParameters): Promise<VaultSupplyAction> {
  if (supplyAmount <= 0n) {
    return {
      status: "error",
      message: "Supply amount must be greater than 0",
    };
  }

  const [simulationState, accountIsContract] = await Promise.all([
    getSimulationState({
      actionType: "vault",
      accountAddress,
      vaultAddress,
      publicClient,
    }),
    getIsContract(publicClient, accountAddress),
  ]);

  const vault = simulationState.getVault(vaultAddress);
  const positionBalanceBefore = simulationState.getHolding(accountAddress, vaultAddress).balance;

  const isMaxSupply = supplyAmount === maxUint256;

  try {
    // Prepare input transfer, and modify simulation state accordingly
    const inputSubbundle = inputTransferSubbundle({
      accountAddress,
      tokenAddress: vault.underlying,
      amount: supplyAmount, // Handles maxUint256
      recipientAddress: GENERAL_ADAPTER_1_ADDRESS,
      config: {
        accountSupportsSignatures: !accountIsContract,
        tokenIsRebasing: false,
        allowWrappingNativeAssets,
      },
      simulationState,
    });

    const ga1AssetBalance = simulationState.getHolding(GENERAL_ADAPTER_1_ADDRESS, vault.asset).balance;

    const vaultSupplySubbundle = subbundleFromInputOps({
      inputOps: [
        {
          type: "MetaMorpho_Deposit",
          sender: accountAddress,
          address: vaultAddress,
          args: {
            assets: isMaxSupply ? ga1AssetBalance : supplyAmount,
            owner: accountAddress,
            slippage: DEFAULT_SLIPPAGE_TOLERANCE,
          },
        },
      ],
      accountAddress,
      accountSupportsSignatures: !accountIsContract,
      simulationState,
      throwIfRequirements: true,
    });

    return {
      ...subbundlesToAction([inputSubbundle, vaultSupplySubbundle], "Confirm Supply"),
      positionBalanceChange: {
        before: positionBalanceBefore,
        after: vaultSupplySubbundle.finalSimulationState.getHolding(accountAddress, vaultAddress).balance,
        delta:
          (vaultSupplySubbundle.finalSimulationState.getHolding(accountAddress, vaultAddress).balance ?? 0n) -
          positionBalanceBefore,
      },
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
