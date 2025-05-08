import { AnvilTestClient } from "@morpho-org/test";
import { Address, erc20Abi, maxUint256 } from "viem";
import { readContract, writeContract } from "viem/actions";

import { aaveV3PoolAbi } from "@/abis/aaveV3PoolAbi";
import { AAVE_V3_POOL_ADDRESS } from "@/config";

export async function dealAndSupplyToAaveV3(
  client: AnvilTestClient,
  assetAddress: Address,
  amount: bigint,
  enableCollateral: boolean
) {
  await client.deal({
    erc20: assetAddress,
    amount,
  });
  await writeContract(client, {
    abi: erc20Abi,
    address: assetAddress,
    functionName: "approve",
    args: [AAVE_V3_POOL_ADDRESS, maxUint256],
  });
  await writeContract(client, {
    abi: aaveV3PoolAbi,
    address: AAVE_V3_POOL_ADDRESS,
    functionName: "supply",
    args: [assetAddress, amount, client.account.address, 0],
  });
  await writeContract(client, {
    abi: aaveV3PoolAbi,
    address: AAVE_V3_POOL_ADDRESS,
    functionName: "setUserUseReserveAsCollateral",
    args: [assetAddress, enableCollateral],
  });
}

export async function borrowFromAaveV3(client: AnvilTestClient, assetAddress: Address, amount: bigint) {
  await writeContract(client, {
    abi: aaveV3PoolAbi,
    address: AAVE_V3_POOL_ADDRESS,
    functionName: "borrow",
    args: [assetAddress, amount, BigInt(2), 0, client.account.address],
  });
}

export async function getAaveV3SupplyBalance(client: AnvilTestClient, supplyAssetAddress: Address) {
  const aTokenAddress = await readContract(client, {
    abi: aaveV3PoolAbi,
    address: AAVE_V3_POOL_ADDRESS,
    functionName: "getReserveAToken",
    args: [supplyAssetAddress],
  });

  return readContract(client, {
    abi: erc20Abi,
    address: aTokenAddress,
    functionName: "balanceOf",
    args: [client.account.address],
  });
}

export async function getAaveV3LoanBalance(client: AnvilTestClient, loanAssetAddress: Address) {
  const vTokenAddress = await readContract(client, {
    abi: aaveV3PoolAbi,
    address: AAVE_V3_POOL_ADDRESS,
    functionName: "getReserveVariableDebtToken",
    args: [loanAssetAddress],
  });

  return readContract(client, {
    abi: erc20Abi,
    address: vTokenAddress,
    functionName: "balanceOf",
    args: [client.account.address],
  });
}
