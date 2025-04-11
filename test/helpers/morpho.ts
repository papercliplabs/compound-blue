import { getSimulationState } from "@/data/getSimulationState";
import { MarketId } from "@morpho-org/blue-sdk";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, erc20Abi, maxUint256 } from "viem";
import { getErc20BalanceOf } from "./erc20";
import { writeContract } from "viem/actions";
import { blueAbi } from "@morpho-org/blue-sdk-viem";
import { MORPHO_BLUE_ADDRESS } from "@/utils/constants";
import { expect } from "vitest";

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

export async function dealAndBorrowFromMorphoMarket(
  client: AnvilTestClient,
  marketId: MarketId,
  collateralAmount: bigint,
  loanAmount: bigint
) {
  const simulationState = await getSimulationState({
    publicClient: client,
    actionType: "market-repay-withdraw-collateral",
    accountAddress: client.account.address,
    marketId,
  });
  const market = simulationState.getMarket(marketId);

  client.deal({
    erc20: market.params.collateralToken,
    amount: collateralAmount,
  });

  await writeContract(client, {
    abi: erc20Abi,
    address: market.params.collateralToken,
    functionName: "approve",
    args: [MORPHO_BLUE_ADDRESS, maxUint256],
  });
  await writeContract(client, {
    address: MORPHO_BLUE_ADDRESS,
    abi: blueAbi,
    functionName: "supplyCollateral",
    args: [
      {
        loanToken: market.params.loanToken,
        collateralToken: market.params.collateralToken,
        oracle: market.params.oracle,
        irm: market.params.irm,
        lltv: market.params.lltv,
      },
      collateralAmount,
      client.account.address,
      "0x",
    ],
  });
  await writeContract(client, {
    address: MORPHO_BLUE_ADDRESS,
    abi: blueAbi,
    functionName: "borrow",
    args: [
      {
        loanToken: market.params.loanToken,
        collateralToken: market.params.collateralToken,
        oracle: market.params.oracle,
        irm: market.params.irm,
        lltv: market.params.lltv,
      },
      loanAmount,
      BigInt(0),
      client.account.address,
      client.account.address,
    ],
  });

  const accountBalance = await getMorphoMarketAccountBalances(client, marketId);
  expect(accountBalance.collateralBalance).toEqual(collateralAmount);
  expect(accountBalance.loanBalance).toBeWithinRange(loanAmount, loanAmount + BigInt(1));
}
