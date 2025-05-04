import { getSimulationState } from "@/data/getSimulationState";
import { PrepareActionReturnType, SimulatedValueChange } from "./helpers";
import { Address, Client } from "viem";
import { getIsContract } from "@/data/getIsContract";
import { GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";
import { CHAIN_ID } from "@/config";
import { BundlerAction, BundlerCall } from "@morpho-org/bundler-sdk-viem";
import { createBundle } from "./bundler3";
import { handleOperation } from "@morpho-org/simulation-sdk";
import { DEFAULT_SLIPPAGE_TOLERANCE, MathLib } from "@morpho-org/blue-sdk";
import { prepareInputTransferSubbundle } from "./subbundles/prepareInputTransferSubbundle";

interface PrepareVaultSupplyActionParameters {
  publicClient: Client;
  vaultAddress: Address;
  accountAddress: Address;
  supplyAmount: bigint; // Max uint256 for entire account balanace
  allowWrappingNativeAssets: boolean; // Ignored if the vault asset is not wrapped native
}

export type PrepareVaultSupplyActionReturnType =
  | (Extract<PrepareActionReturnType, { status: "success" }> & {
      positionBalanceChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareActionReturnType, { status: "error" }>;

export async function prepareVaultSupplyBundle({
  publicClient,
  vaultAddress,
  accountAddress,
  supplyAmount,
  allowWrappingNativeAssets = false,
}: PrepareVaultSupplyActionParameters): Promise<PrepareVaultSupplyActionReturnType> {
  if (supplyAmount <= 0n) {
    return {
      status: "error",
      message: "Supply amount must be greater than 0",
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

  const vault = simulationState.getVault(vaultAddress);
  const positionBalanceBefore = simulationState.getHolding(accountAddress, vaultAddress).balance;

  try {
    // Prepare input transfer, and modify simulation state accordingly
    const inputTransferSubbundle = prepareInputTransferSubbundle({
      accountAddress,
      tokenAddress: vault.underlying,
      amount: supplyAmount, // Handles maxUint256
      recipientAddress: GENERAL_ADAPTER_1_ADDRESS,
      config: {
        accountSupportsSignatures: !isContract,
        tokenIsRebasing: false,
        allowWrappingNativeAssets,
      },
      simulationState,
    });

    // Simulate the deposit operation
    const finalSimulationState = handleOperation(
      {
        type: "MetaMorpho_Deposit",
        sender: GENERAL_ADAPTER_1_ADDRESS,
        address: vaultAddress,
        args: {
          assets: supplyAmount, // Handles maxUint256
          owner: accountAddress,
        },
      },
      simulationState
    );

    const maxSharePriceE27 = vault.toAssets(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

    const bundlerCalls: BundlerCall[] = [
      ...inputTransferSubbundle.bundlerCalls,
      BundlerAction.erc4626Deposit(CHAIN_ID, vault.address, supplyAmount, maxSharePriceE27, accountAddress),
    ].flat();

    const bundle = createBundle(bundlerCalls);

    return {
      status: "success",
      signatureRequests: [...inputTransferSubbundle.signatureRequirements],
      transactionRequests: [
        ...inputTransferSubbundle.transactionRequirements,
        {
          tx: () => bundle,
          name: "Confirm Supply",
        },
      ],
      positionBalanceChange: {
        before: positionBalanceBefore,
        after: finalSimulationState.getHolding(accountAddress, vaultAddress).balance,
      },
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
