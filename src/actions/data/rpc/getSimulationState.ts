import { Holding, MarketId, NATIVE_ADDRESS, Position, VaultMarketConfig, VaultUser } from "@morpho-org/blue-sdk";
import {
  fetchAccrualVault,
  fetchHolding,
  fetchMarket,
  fetchPosition,
  fetchToken,
  fetchUser,
  fetchVaultMarketConfig,
  fetchVaultUser,
} from "@morpho-org/blue-sdk-viem";
import { SimulationState } from "@morpho-org/simulation-sdk";
import { Address, Client, zeroAddress } from "viem";
import { getBlock } from "viem/actions";

import { CHAIN_ID, PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION } from "@/config";
import { SUPPORTED_ADDAPTERS, WAD, WRAPPED_NATIVE_ADDRESS } from "@/utils/constants";

type GetSimulationStateMarketTypeParameters = {
  actionType: "market";
  marketId: MarketId;
} & (
  | {
      requiresPublicReallocation: false;
    }
  | {
      requiresPublicReallocation: true;
      allocatingVaultAddresses: Address[];
    }
);

type GetSimulationStateVaultTypeParameters = {
  actionType: "vault";
  vaultAddress: Address;
};

export type GetSimulationStateParameters = {
  publicClient: Client;
  accountAddress: Address;
  additionalTokenAddresses?: Address[];
} & (GetSimulationStateMarketTypeParameters | GetSimulationStateVaultTypeParameters);

// Derive simulation state from real time on-chain data
// Only use this for preparing actions as it is an expensive operation
export async function getSimulationState({
  publicClient,
  accountAddress,
  additionalTokenAddresses,
  ...params
}: GetSimulationStateParameters) {
  let vaultAddresses: Address[] = [];
  let marketIds: MarketId[] = [];

  switch (params.actionType) {
    case "vault":
      vaultAddresses = [params.vaultAddress];
      break;
    case "market":
      marketIds = [params.marketId];
      if (params.requiresPublicReallocation) {
        vaultAddresses = params.allocatingVaultAddresses;
      }
      break;
  }

  const vaults = await Promise.all(vaultAddresses.map((vaultAddress) => fetchAccrualVault(vaultAddress, publicClient)));

  // Add markets from the vault queues
  marketIds = Array.from(
    new Set(marketIds.concat(vaults.flatMap((vault) => vault.supplyQueue.concat(vault.withdrawQueue))))
  );

  const userAddresses = [accountAddress, ...SUPPORTED_ADDAPTERS, ...vaultAddresses];

  const positionParams: { userAddress: Address; marketId: MarketId }[] = Array.from(userAddresses).flatMap(
    (userAddress) => Array.from(marketIds, (marketId) => ({ userAddress, marketId }))
  );

  const vaultMarketConfigParams: { vaultAddress: Address; marketId: MarketId }[] = Array.from(vaultAddresses).flatMap(
    (vaultAddress) => Array.from(marketIds, (marketId) => ({ vaultAddress, marketId }))
  );

  const vaultUserParams: { vaultAddress: Address; userAddress: Address }[] = Array.from(vaultAddresses).flatMap(
    (vaultAddress) => Array.from(userAddresses, (userAddress) => ({ vaultAddress, userAddress }))
  );

  const [block, markets, users, positions, vaultMarketConfigs, vaultUsers] = await Promise.all([
    getBlock(publicClient),
    Promise.all(marketIds.map((marketId) => fetchMarket(marketId, publicClient))),
    Promise.all(userAddresses.map((userAddress) => fetchUser(userAddress, publicClient))),
    Promise.all(positionParams.map(({ userAddress, marketId }) => fetchPosition(userAddress, marketId, publicClient))),
    Promise.all(
      vaultMarketConfigParams.map(({ vaultAddress, marketId }) =>
        fetchVaultMarketConfig(vaultAddress, marketId, publicClient)
      )
    ),
    Promise.all(
      vaultUserParams.map(({ vaultAddress, userAddress }) => fetchVaultUser(vaultAddress, userAddress, publicClient))
    ),
  ]);

  // Derive the tokens that will be involved in the action
  let tokenAddresses: Address[] = [];
  switch (params.actionType) {
    case "vault":
      tokenAddresses = [
        vaults[0].asset,
        vaults[0].address,
        NATIVE_ADDRESS,
        WRAPPED_NATIVE_ADDRESS,
        ...(additionalTokenAddresses ?? []),
      ]; // Underliying and the vault share token move
      break;
    case "market":
      tokenAddresses = [
        markets[0].params.loanToken,
        markets[0].params.collateralToken,
        NATIVE_ADDRESS,
        WRAPPED_NATIVE_ADDRESS,
        ...(additionalTokenAddresses ?? []),
      ];
      break;
  }

  const holdingParams: { userAddress: Address; tokenAddress: Address }[] = Array.from(userAddresses).flatMap(
    (userAddress) => Array.from(tokenAddresses, (tokenAddress) => ({ userAddress, tokenAddress }))
  );

  const [tokens, holdings] = await Promise.all([
    Promise.all(tokenAddresses.map((tokenAddress) => fetchToken(tokenAddress, publicClient))),
    Promise.all(
      holdingParams.map(({ userAddress, tokenAddress }) => fetchHolding(userAddress, tokenAddress, publicClient))
    ),
  ]);

  // Accrue interest on all vaults and markets
  const accruedMarkets = markets.map((market) => market.accrueInterest(block.timestamp));
  const accruedVaults = vaults.map((vault) => vault.accrueInterest(block.timestamp));

  const simulationState = new SimulationState({
    chainId: CHAIN_ID,
    block,
    global: { feeRecipient: zeroAddress },
    markets: Object.fromEntries(marketIds.map((marketId, i) => [marketId, accruedMarkets[i]])),
    users: Object.fromEntries(userAddresses.map((userAddress, i) => [userAddress, users[i]])),
    tokens: Object.fromEntries(tokenAddresses.map((tokenAddress, i) => [tokenAddress, tokens[i]])),
    vaults: Object.fromEntries(vaultAddresses.map((vaultAddress, i) => [vaultAddress, accruedVaults[i]])),

    positions: positionParams.reduce(
      (acc, { userAddress, marketId }, i) => {
        if (!acc[userAddress]) {
          acc[userAddress] = {};
        }
        acc[userAddress][marketId] = positions[i];
        return acc;
      },
      {} as Record<Address, Record<MarketId, Position>>
    ),

    holdings: holdingParams.reduce(
      (acc, { userAddress, tokenAddress }, i) => {
        if (!acc[userAddress]) {
          acc[userAddress] = {};
        }
        acc[userAddress][tokenAddress] = holdings[i];
        return acc;
      },
      {} as Record<Address, Record<Address, Holding>>
    ),

    vaultMarketConfigs: vaultMarketConfigParams.reduce(
      (acc, { vaultAddress, marketId }, i) => {
        if (!acc[vaultAddress]) {
          acc[vaultAddress] = {};
        }
        acc[vaultAddress][marketId] = vaultMarketConfigs[i];
        return acc;
      },
      {} as Record<Address, Record<MarketId, VaultMarketConfig>>
    ),

    vaultUsers: vaultUserParams.reduce(
      (acc, { vaultAddress, userAddress }, i) => {
        if (!acc[vaultAddress]) {
          acc[vaultAddress] = {};
        }
        acc[vaultAddress][userAddress] = vaultUsers[i];
        return acc;
      },
      {} as Record<Address, Record<Address, VaultUser>>
    ),
  });

  return simulationState;
}

// Build the simulation state, and include state for public reallocation if it is required based on the requested borrow amount
export async function getMarketSimulationStateAccountingForPublicReallocation({
  publicClient,
  marketId,
  accountAddress,
  allocatingVaultAddresses,
  requestedBorrowAmount,
  additionalTokenAddresses,
}: {
  publicClient: Client;
  marketId: MarketId;
  accountAddress: Address;
  allocatingVaultAddresses: Address[];
  requestedBorrowAmount: bigint;
  additionalTokenAddresses?: Address[];
}) {
  const simulationStateWithoutPublicReallocation = await getSimulationState({
    actionType: "market",
    accountAddress,
    marketId,
    publicClient,
    requiresPublicReallocation: false,
    additionalTokenAddresses,
  });

  const market = simulationStateWithoutPublicReallocation.getMarket(marketId);

  const supplyAssets = market.totalSupplyAssets;
  const borrowAssets = market.totalBorrowAssets + requestedBorrowAmount;
  const utilization = supplyAssets > BigInt(0) ? (borrowAssets * WAD) / supplyAssets : BigInt(0);
  const requiresPublicReallocation = utilization > PUBLIC_ALLOCATOR_SUPPLY_TARGET_UTILIZATION;

  if (!requiresPublicReallocation) {
    return simulationStateWithoutPublicReallocation;
  } else {
    return await getSimulationState({
      actionType: "market",
      accountAddress,
      marketId,
      publicClient,
      allocatingVaultAddresses,
      requiresPublicReallocation: true,
      additionalTokenAddresses,
    });
  }
}
