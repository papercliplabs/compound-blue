import { getSimulationState } from "@/data/getSimulationState";
import { MarketId } from "@morpho-org/blue-sdk";
import { AnvilTestClient } from "@morpho-org/test";
import { Address } from "viem";
import { getErc20BalanceOf } from "./erc20";

export async function getMorphoMarketAccountBalances(client: AnvilTestClient, marketId: MarketId) {
  const simulationState = await getSimulationState({
    publicClient: client,
    actionType: "market-repay-withdraw-collateral",
    accountAddress: client.account.address,
    marketId,
  });

  const accrualPosition = simulationState.getAccrualPosition(client.account.address, marketId);
  return { collateralBalance: accrualPosition.collateral, loanBalance: accrualPosition.borrowAssets };
}

export async function getMorphoVaultAccountBalance(client: AnvilTestClient, vaultAddress: Address) {
  const simulationState = await getSimulationState({
    publicClient: client,
    actionType: "vault-supply",
    accountAddress: client.account.address,
    vaultAddress,
  });
  const vault = simulationState.getVault(vaultAddress);

  const userShareBalance = await getErc20BalanceOf(client, client.account.address, vaultAddress);
  const userAssetBalance = vault.toAssets(userShareBalance);
  return userAssetBalance;
}
