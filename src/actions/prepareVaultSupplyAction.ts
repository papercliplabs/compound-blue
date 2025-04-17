import { getSimulationState } from "@/data/getSimulationState";
import { PrepareActionReturnType, SimulatedValueChange } from "./helpers";
import { Address, Client } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";
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
  allowWrappingNativeAssets: boolean;
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
  if (supplyAmount == BigInt(0)) {
    return {
      status: "error",
      message: "Input validation: Supply amount cannot be 0",
    };
  }

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
  const positionBalanceBefore = simulationState.getHolding(accountAddress, vaultAddress).balance;

  try {
    const inputTransferSubbundle = prepareInputTransferSubbundle({
      accountAddress,
      tokenAddress: vault.underlying,
      amount: supplyAmount,
      recipientAddress: GENERAL_ADAPTER_1_ADDRESS,
      config: {
        accountSupportsSignatures: !isSmartAccount,
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
          assets: supplyAmount,
          owner: accountAddress,
        },
      },
      simulationState
    );

    const maxSharePriceE27 = vault.toAssets(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

    function getBundleTx() {
      const bundlerCalls: BundlerCall[] = [
        ...inputTransferSubbundle.bundlerCalls,
        BundlerAction.erc4626Deposit(CHAIN_ID, vault.address, supplyAmount, maxSharePriceE27, accountAddress),
      ].flat();

      return createBundle(bundlerCalls);
    }

    return {
      status: "success",
      signatureRequests: [...inputTransferSubbundle.signatureRequirements],
      transactionRequests: [
        ...inputTransferSubbundle.transactionRequirements,
        {
          tx: getBundleTx,
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
