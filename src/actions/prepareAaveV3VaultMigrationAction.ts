import { DEFAULT_SLIPPAGE_TOLERANCE, MathLib } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType } from "./helpers";
import { Address, Client, maxUint256 } from "viem";
import { BundlerAction, BundlerCall } from "@morpho-org/bundler-sdk-viem";
import { AAVE_V3_POOL_ADDRESS, CHAIN_ID } from "@/config";
import { getSimulationState } from "@/data/getSimulationState";
import { readContract } from "viem/actions";
import { aaveV3PoolAbi } from "@/abis/aaveV3PoolAbi";
import { AAVE_V3_MIGRATION_ADAPTER_ADDRESS, GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";
import { prepareInputTransferSubbundle } from "./subbundles/prepareInputTransferSubbundle";
import { getIsContract } from "@/data/getIsContract";
import { createBundle } from "./bundler3";
import { fetchVault } from "@morpho-org/blue-sdk-viem";

interface PrepareAaveV3VaultMigrationActionParameters {
  publicClient: Client;
  accountAddress: Address;
  vaultAddress: Address;
  amount: bigint; // Max uint256 for entire account balance
}

export async function prepareAaveV3VaultMigrationAction({
  publicClient,
  accountAddress,
  vaultAddress,
  amount,
}: PrepareAaveV3VaultMigrationActionParameters): Promise<PrepareActionReturnType> {
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
    const inputTransferSubbundle = prepareInputTransferSubbundle({
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

    const bundlerCalls: BundlerCall[] = [
      // Handle all input token transfers
      ...inputTransferSubbundle.bundlerCalls,
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

    const bundle = createBundle(bundlerCalls);

    return {
      status: "success",
      signatureRequests: [...inputTransferSubbundle.signatureRequirements],
      transactionRequests: [
        ...inputTransferSubbundle.transactionRequirements,
        {
          name: "Confirm Migration",
          tx: () => bundle,
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
