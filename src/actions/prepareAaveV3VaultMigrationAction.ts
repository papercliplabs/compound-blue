import { DEFAULT_SLIPPAGE_TOLERANCE, MathLib } from "@morpho-org/blue-sdk";
import { PrepareActionReturnType } from "./helpers";
import { Address, Client, encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import { BundlerAction } from "@morpho-org/bundler-sdk-viem";
import { AAVE_V3_POOL_ADDRESS, CHAIN_ID } from "@/config";
import { TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { getSimulationState } from "@/data/getSimulationState";
import { readContract } from "viem/actions";
import { aaveV3PoolAbi } from "@/abis/aaveV3PoolAbi";
import { AAVE_V3_MIGRATION_ADAPTER_ADDRESS, GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";

const REBASEING_MARGIN = BigInt(100030);
const REBASEING_MARGIN_SCALE = BigInt(100000);

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
  if (!AAVE_V3_MIGRATION_ADAPTER_ADDRESS) {
    return {
      status: "error",
      message: "Aave V3 Migrations not supported (missing adapter(s)).",
    };
  }

  const simulationState = await getSimulationState({
    actionType: "vault",
    accountAddress,
    vaultAddress,
    publicClient,
  });

  const vault = simulationState.getVault(vaultAddress);

  const aTokenAddress = await readContract(publicClient, {
    address: AAVE_V3_POOL_ADDRESS,
    abi: aaveV3PoolAbi,
    functionName: "getReserveAToken",
    args: [vault.asset],
  });

  const [allowance, balance] = await Promise.all([
    readContract(publicClient, {
      abi: erc20Abi,
      address: aTokenAddress,
      functionName: "allowance",
      args: [accountAddress, GENERAL_ADAPTER_1_ADDRESS],
    }),
    readContract(publicClient, {
      abi: erc20Abi,
      address: aTokenAddress,
      functionName: "balanceOf",
      args: [accountAddress],
    }),
  ]);

  const maxSharePriceE27 = vault.toAssets(MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE));

  // Since aTokens are rebasing, exact approval for max transfers is not possible.
  // So, in this case we require allowance of the actual balance with a margin to account for rebasing.
  const requiredAllowance = amount == maxUint256 ? (balance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE : amount;

  // Could use permit2, but AAVE doesn't use permit2, and the assumption is the user likely will only do this once, so direct approval is actually more user friendly (2 steps instead of 3).
  // aTokens do support permit, which would be best, but keeping simple for now.
  const aTokenMaxApproveTx: ReturnType<TransactionRequest["tx"]> = {
    to: aTokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [GENERAL_ADAPTER_1_ADDRESS, requiredAllowance],
    }),
    value: BigInt(0),
  };

  const bundle = BundlerAction.encodeBundle(CHAIN_ID, [
    {
      // Move users aToken into aaveV3MigrationAdapter
      type: "erc20TransferFrom",
      args: [aTokenAddress, amount, AAVE_V3_MIGRATION_ADAPTER_ADDRESS],
    },
    {
      // Redeem aTokens for underlying and send to GA1
      type: "aaveV3Withdraw",
      args: [
        vault.asset,
        maxUint256, // Max to use all aTokens in the adapter
        GENERAL_ADAPTER_1_ADDRESS,
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
