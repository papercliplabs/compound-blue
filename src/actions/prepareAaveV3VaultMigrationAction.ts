import { addresses, DEFAULT_SLIPPAGE_TOLERANCE, MathLib } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType } from "./helpers";
import { Address, Client, encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import { BundlerAction } from "@morpho-org/bundler-sdk-viem";
import { CHAIN_ID } from "@/config";
import { TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { getSimulationState } from "@/data/getSimulationState";
import { readContract } from "viem/actions";

const { bundler3 } = addresses[CHAIN_ID];

const REBASEING_ALLOWANCE_MARGIN = BigInt(1100);
const REBASEING_ALLOWANCE_MARGIN_SCALE = BigInt(1000);

interface PrepareAaveV3VaultMigrationActionParameters {
  publicClient: Client;
  accountAddress: Address;
  aTokenAddress: Address;
  aTokenAmount: bigint; // Max uint256 for entire account balanace
  vaultAddress: Address;
}

export async function prepareVaultMigrationBundle({
  publicClient,
  accountAddress,
  aTokenAddress,
  aTokenAmount,
  vaultAddress,
}: PrepareAaveV3VaultMigrationActionParameters): Promise<PrepareActionReturnType> {
  const [simulationState, allowance, balance] = await Promise.all([
    getSimulationState({
      actionType: "vault-supply",
      accountAddress,
      vaultAddress,
      publicClient,
    }),
    readContract(publicClient, {
      abi: erc20Abi,
      address: aTokenAddress,
      functionName: "allowance",
      args: [accountAddress, bundler3.generalAdapter1],
    }),
    readContract(publicClient, {
      abi: erc20Abi,
      address: aTokenAddress,
      functionName: "balanceOf",
      args: [accountAddress],
    }),
  ]);

  const vault = simulationState.getVault(vaultAddress);
  const maxSharePriceE27 = vault.toAssets(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

  // Since aTokens are rebasing, exact approval for max transfers is not possible.
  // So, in this case we require allowance of the actual balance with a margin to account for rebasing.
  const requiredAllowance =
    aTokenAmount == maxUint256
      ? (balance * REBASEING_ALLOWANCE_MARGIN) / REBASEING_ALLOWANCE_MARGIN_SCALE
      : aTokenAmount;

  // Could use permit2, but AAVE doesn't use permit2, and the assumption is the user likely will only do this once, so direct approval is actually more user friendly (2 steps instead of 3).
  // aTokens do support permit, which would be best, but keeping simple for now.
  const aTokenMaxApproveTx: ReturnType<TransactionRequest["tx"]> = {
    to: aTokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [bundler3.generalAdapter1, requiredAllowance],
    }),
    value: BigInt(0),
  };

  const bundle = BundlerAction.encodeBundle(CHAIN_ID, [
    {
      // Move users aToken into aaveV3MigrationAdapter
      type: "erc20TransferFrom",
      args: [aTokenAddress, aTokenAmount, bundler3.aaveV3CoreMigrationAdapter],
    },
    {
      // Redeem aTokens for underlying and send to GA1
      type: "aaveV3Withdraw",
      args: [
        vault.asset,
        maxUint256, // Max to use all aTokens in the adapter
        bundler3.generalAdapter1,
      ],
    },
    {
      // Deposit underlying into vault and send shares to the calling account
      type: "erc4626Deposit",
      args: [
        vaultAddress,
        maxUint256, // Max to use all underlying tokens in the adapter
        maxSharePriceE27,
        accountAddress, // Calling account is the receiver of the vault shares
      ],
    },
  ]);

  return {
    status: "success",
    signatureRequests: [],
    transactionRequests: [
      ...(allowance < requiredAllowance
        ? [
            {
              name: "Approve aTokens",
              tx: () => aTokenMaxApproveTx,
            },
          ]
        : []),
      {
        name: "Confirm Migration",
        tx: () => bundle,
      },
    ],
  };
}
