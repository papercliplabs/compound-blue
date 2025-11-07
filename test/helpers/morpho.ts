import { MarketId } from "@morpho-org/blue-sdk";
import { blueAbi, fetchMarket, fetchVaultConfig, metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, Hex, erc20Abi, maxUint256, parseEther } from "viem";
import { writeContract } from "viem/actions";
import { expect } from "vitest";

import { getSimulationState } from "@/actions/data/rpc/getSimulationState";
import { MORPHO_BLUE_ADDRESS } from "@/utils/constants";

import { RANDOM_ADDRESS } from "./constants";
import { getErc20BalanceOf } from "./erc20";

export async function getMorphoMarketPosition(
  client: AnvilTestClient,
  marketId: MarketId,
  accountAddress: Address = client.account.address
) {
  const simulationState = await getSimulationState({
    publicClient: client,
    actionType: "market",
    accountAddress: accountAddress,
    marketId,
    requiresPublicReallocation: false,
  });

  const accrualPosition = simulationState.getAccrualPosition(accountAddress, marketId);
  return { collateralBalance: accrualPosition.collateral, loanBalance: accrualPosition.borrowAssets };
}

export async function getMorphoVaultPosition(
  client: AnvilTestClient,
  vaultAddress: Address,
  accountAddress: Address = client.account.address
) {
  const simulationState = await getSimulationState({
    publicClient: client,
    actionType: "vault",
    accountAddress: accountAddress,
    vaultAddress,
  });
  const vault = simulationState.getVault(vaultAddress);

  const userShareBalance = await getErc20BalanceOf(client, vaultAddress, accountAddress);
  const userAssetBalance = vault.toAssets(userShareBalance);
  return { userAssetBalance, userShareBalance };
}

export async function getMorphoVaultSharesToAssets(
  client: AnvilTestClient,
  vaultAddress: Address,
  accountAddress: Address,
  shares: bigint
) {
  const simulationState = await getSimulationState({
    publicClient: client,
    actionType: "vault",
    accountAddress,
    vaultAddress,
  });

  const vault = simulationState.getVault(vaultAddress);
  return vault.toAssets(shares);
}

// Supply loan assets directly to a market from account for onBehalf
export async function dealAndSupplyToMorphoMarket(
  client: AnvilTestClient,
  marketId: MarketId,
  amount: bigint,
  onBehalf?: Address, // Uses account, then client.account if not provided
  account?: Address // Uses client.account if not provided
) {
  const market = await fetchMarket(marketId, client);

  await client.deal({
    erc20: market.params.loanToken,
    amount: amount,
    account: account,
  });

  await writeContract(client, {
    address: market.params.loanToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [MORPHO_BLUE_ADDRESS, amount],
    account,
  });

  await writeContract(client, {
    address: MORPHO_BLUE_ADDRESS,
    abi: blueAbi,
    functionName: "supply",
    args: [
      {
        loanToken: market.params.loanToken,
        collateralToken: market.params.collateralToken,
        oracle: market.params.oracle,
        irm: market.params.irm,
        lltv: market.params.lltv,
      },
      amount,
      BigInt(0),
      onBehalf ?? account ?? client.account.address,
      "0x",
    ],
    account,
  });
}

// Supply loan assets directly to a market from account for onBehalf
export async function dealAndSupplyCollateralToMorphoMarket(
  client: AnvilTestClient,
  marketId: MarketId,
  amount: bigint,
  onBehalf: Address = client.account.address
) {
  const market = await fetchMarket(marketId, client);

  await client.deal({
    erc20: market.params.collateralToken,
    amount: amount,
  });

  await writeContract(client, {
    address: market.params.collateralToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [MORPHO_BLUE_ADDRESS, amount],
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
      amount,
      onBehalf,
      "0x",
    ],
  });
}

export async function dealAndSupplyToMorphoVault(
  client: AnvilTestClient,
  vaultAddress: Address,
  supplyAmount: bigint,
  dealAmount: bigint = supplyAmount
) {
  const vaultConfig = await fetchVaultConfig(vaultAddress, client);
  await client.deal({
    erc20: vaultConfig.asset,
    amount: dealAmount,
  });

  await writeContract(client, {
    address: vaultConfig.asset,
    abi: erc20Abi,
    functionName: "approve",
    args: [vaultAddress, supplyAmount],
  });

  await writeContract(client, {
    address: vaultAddress,
    abi: metaMorphoAbi,
    functionName: "deposit",
    args: [supplyAmount, client.account.address],
  });
}

export async function dealAndBorrowFromMorphoMarket(
  client: AnvilTestClient,
  marketId: MarketId,
  collateralAmount: bigint,
  loanAmount: bigint
) {
  const simulationState = await getSimulationState({
    publicClient: client,
    actionType: "market",
    accountAddress: client.account.address,
    marketId,
    requiresPublicReallocation: false,
  });
  const market = simulationState.getMarket(marketId);

  await client.deal({
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

  const accountBalance = await getMorphoMarketPosition(client, marketId);
  expect(accountBalance.collateralBalance).toEqual(collateralAmount);
  expect(accountBalance.loanBalance).toBeWithinRange(loanAmount, loanAmount + BigInt(1));
}

export async function seedMarketLiquidity(client: AnvilTestClient, marketId: Hex, supplyAmount: bigint) {
  const supplyAmountInternal = supplyAmount + 1n; // Extra to make 0 supply work
  const market = await fetchMarket(marketId as MarketId, client);
  const { loanToken: loanAssetAddress } = market.params;
  await client.deal({ erc20: loanAssetAddress, amount: supplyAmountInternal, account: RANDOM_ADDRESS });
  await client.setBalance({ address: RANDOM_ADDRESS, value: parseEther("10") });

  await writeContract(client, {
    address: loanAssetAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [MORPHO_BLUE_ADDRESS, supplyAmountInternal],
    account: RANDOM_ADDRESS,
  });

  // Supply on behalf of random address
  await writeContract(client, {
    address: MORPHO_BLUE_ADDRESS,
    abi: blueAbi,
    functionName: "supply",
    args: [
      {
        loanToken: market.params.loanToken,
        collateralToken: market.params.collateralToken,
        oracle: market.params.oracle,
        irm: market.params.irm,
        lltv: market.params.lltv,
      },
      supplyAmountInternal,
      BigInt(0),
      RANDOM_ADDRESS,
      "0x",
    ],
    account: RANDOM_ADDRESS,
  });
}
