import { Address, Client, erc20Abi } from "viem";
import { readContract } from "viem/actions";

import { aaveV3UiPoolDataProviderAbi } from "@/abis/aaveV3UiPoolDataProviderAbi";
import { AAVE_V3_POOL_ADDRESS_PROVIDER, AAVE_V3_UI_POOL_DATA_PROVIDER_ADDRESS } from "@/config";

interface AaveV3Position {
  underlyingAssetAddress: Address;
  aTokenAddress: Address;
  supplyBalance: bigint; // aToken balance
  borrowBalance: bigint; // vToken balance
}

export async function getAaveV3Positions(publicClient: Client, accountAddress: Address): Promise<AaveV3Position[]> {
  const [aggregatedReserves] = await readContract(publicClient, {
    address: AAVE_V3_UI_POOL_DATA_PROVIDER_ADDRESS,
    abi: aaveV3UiPoolDataProviderAbi,
    functionName: "getReservesData",
    args: [AAVE_V3_POOL_ADDRESS_PROVIDER],
  });

  const activeReserves = aggregatedReserves.filter((r) => r.isActive);

  const positions: AaveV3Position[] = await Promise.all(
    activeReserves.map(async (r) => {
      const [supplyBalance, borrowBalance] = await Promise.all([
        readContract(publicClient, {
          address: r.aTokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [accountAddress],
        }),
        readContract(publicClient, {
          address: r.variableDebtTokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [accountAddress],
        }),
      ]);

      return {
        underlyingAssetAddress: r.underlyingAsset,
        aTokenAddress: r.aTokenAddress,
        supplyBalance,
        borrowBalance,
      };
    })
  );

  return positions;
}
