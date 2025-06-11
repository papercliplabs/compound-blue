import { DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { produceImmutable } from "@morpho-org/simulation-sdk";
import { Address, Client, maxUint256 } from "viem";

import { getIsContract } from "@/actions/data/rpc/getIsContract";
import { getSimulationState } from "@/actions/data/rpc/getSimulationState";
import { GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";

import { inputTransferSubbundle } from "../subbundles/inputTransferSubbundle";
import { subbundleFromInputOps } from "../subbundles/subbundleFromInputOps";
import { VaultPositionChange, computeVaultPositionChange } from "../utils/positionChange";
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
  | (Extract<Action, { status: "success" }> & VaultPositionChange)
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

  const [intitialSimulationState, accountIsContract] = await Promise.all([
    getSimulationState({
      actionType: "vault",
      accountAddress,
      vaultAddress,
      publicClient,
    }),
    getIsContract(publicClient, accountAddress),
  ]);

  const vault = intitialSimulationState.getVault(vaultAddress);

  const isMaxSupply = supplyAmount === maxUint256;

  try {
    const intermediateSimulationState = produceImmutable(intitialSimulationState, () => {});

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
      simulationState: intermediateSimulationState,
    });

    const ga1AssetBalance = intermediateSimulationState.getHolding(GENERAL_ADAPTER_1_ADDRESS, vault.asset).balance;

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
      simulationState: intermediateSimulationState,
      throwIfRequirements: true,
    });

    return {
      ...subbundlesToAction([inputSubbundle, vaultSupplySubbundle], "Confirm Supply"),
      ...computeVaultPositionChange(
        vaultAddress,
        accountAddress,
        intitialSimulationState,
        vaultSupplySubbundle.finalSimulationState
      ),
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
