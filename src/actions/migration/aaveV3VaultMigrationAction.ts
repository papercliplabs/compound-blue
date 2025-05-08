import { DEFAULT_SLIPPAGE_TOLERANCE, MathLib } from "@morpho-org/blue-sdk";
import { fetchVault } from "@morpho-org/blue-sdk-viem";
import { BundlerAction, BundlerCall } from "@morpho-org/bundler-sdk-viem";
import { Address, Client, maxUint256 } from "viem";
import { readContract } from "viem/actions";

import { aaveV3PoolAbi } from "@/abis/aaveV3PoolAbi";
import { getIsContract } from "@/actions/data/rpc/getIsContract";
import { getSimulationState } from "@/actions/data/rpc/getSimulationState";
import { AAVE_V3_POOL_ADDRESS, CHAIN_ID } from "@/config";
import { AAVE_V3_MIGRATION_ADAPTER_ADDRESS, GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";

import { inputTransferSubbundle } from "../subbundles/inputTransferSubbundle";
import { createBundle } from "../utils/bundlerActions";
import { Action } from "../utils/types";

interface AaveV3VaultMigrationActionParameters {
  publicClient: Client;
  vaultAddress: Address;
  accountAddress: Address;
  amount: bigint; // Max uint256 for entire account balance
}

export async function aaveV3VaultMigrationAction({
  publicClient,
  vaultAddress,
  accountAddress,
  amount,
}: AaveV3VaultMigrationActionParameters): Promise<Action> {
  if (amount <= 0n) {
    return {
      status: "error",
      message: "Amount must be greater than 0",
    };
  }

  const vaultAssetAddress = (await fetchVault(vaultAddress, publicClient)).asset;
  const aTokenAddress = await readContract(publicClient, {
    address: AAVE_V3_POOL_ADDRESS,
    abi: aaveV3PoolAbi,
    functionName: "getReserveAToken",
    args: [vaultAssetAddress],
  });

  const [simulationState, isContract] = await Promise.all([
    getSimulationState({
      actionType: "vault",
      accountAddress,
      vaultAddress,
      publicClient,
      additionalTokenAddresses: [aTokenAddress],
    }),
    getIsContract(publicClient, accountAddress),
  ]);

  const vault = simulationState.getVault(vaultAddress);

  try {
    const inputBundle = inputTransferSubbundle({
      accountAddress,
      tokenAddress: aTokenAddress,
      amount, // Handles maxUint256
      recipientAddress: AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
      config: {
        accountSupportsSignatures: !isContract,
        tokenIsRebasing: true, // Is rebasing, this will handle extra approval for full migrations
        allowWrappingNativeAssets: false,
      },
      simulationState,
    });

    const maxSharePriceE27 = vault.toAssets(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

    function getBundleTx() {
      const bundlerCalls: BundlerCall[] = [
        // Transfer aTokens into migration adapter
        ...inputBundle.bundlerCalls(),
        // Redeem aTokens for underlying and send to GA1
        BundlerAction.aaveV3Withdraw(CHAIN_ID, vault.asset, maxUint256, GENERAL_ADAPTER_1_ADDRESS),
        // Deposit underlying into vault and send shares to the calling account
        BundlerAction.erc4626Deposit(
          CHAIN_ID,
          vaultAddress, // Max to use all underlying tokens in the adapter
          maxUint256,
          maxSharePriceE27,
          accountAddress
        ),
      ].flat();

      return createBundle(bundlerCalls);
    }

    return {
      status: "success",
      signatureRequests: [...inputBundle.signatureRequirements],
      transactionRequests: [
        ...inputBundle.transactionRequirements,
        {
          name: "Confirm Migration",
          tx: getBundleTx,
        },
      ],
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
