import { CHAIN_ID, WHITELISTED_MARKET_IDS, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { addresses, Holding, MarketId, Position, VaultMarketConfig, VaultUser } from "@morpho-org/blue-sdk";
import {
  fetchHolding,
  fetchMarket,
  fetchPosition,
  fetchToken,
  fetchUser,
  fetchVault,
  fetchVaultMarketConfig,
  fetchVaultUser,
} from "@morpho-org/blue-sdk-viem";
import { values } from "@morpho-org/morpho-ts";
import { SimulationState } from "@morpho-org/simulation-sdk";
import { Address, Client, zeroAddress } from "viem";
import { getBlock } from "viem/actions";

const { bundler3 } = addresses[CHAIN_ID];

type GetSimulationStateBaseParameters = {
  publicClient: Client;
  accountAddress: Address;
};

export type GetSimulationStateVaultSupplyParameters = GetSimulationStateBaseParameters & {
  actionType: "vault-supply";
  vaultAddress: Address;
};

export type GetSimulationStateVaultWithdrawParameters = GetSimulationStateBaseParameters & {
  actionType: "vault-withdraw";
  vaultAddress: Address;
};

export type GetSimulationStateMarketRepayWithdrawParameters = GetSimulationStateBaseParameters & {
  actionType: "market-repay-withdraw";
  marketId: MarketId;
};

export type GetSimuationStateMarketSupplyBorrowParameters = GetSimulationStateBaseParameters & {
  actionType: "market-supply-borrow";
  marketId: MarketId;
  requiresReallocation: boolean;
};

export type GetSimulationStateParameters =
  | GetSimulationStateVaultSupplyParameters
  | GetSimulationStateVaultWithdrawParameters
  | GetSimulationStateMarketRepayWithdrawParameters
  | GetSimuationStateMarketSupplyBorrowParameters;

// Derive simulation state from real time on-chain data
// Only use this for preparing actions as it is an expensive operation
export async function getSimulationState({ publicClient, accountAddress, ...params }: GetSimulationStateParameters) {
  let vaultAddresses: Address[] = [];
  let marketIds: MarketId[] = [];
  switch (params.actionType) {
    case "vault-supply":
    case "vault-withdraw":
      vaultAddresses = [params.vaultAddress];
      break;
    case "market-repay-withdraw":
      marketIds = [params.marketId];
      break;
    case "market-supply-borrow":
      if (params.requiresReallocation) {
        // Requires everything for public reallocation
        marketIds = [params.marketId, ...(WHITELISTED_MARKET_IDS as MarketId[]).filter((id) => id !== params.marketId)]; // target market id is first
        vaultAddresses = WHITELISTED_VAULT_ADDRESSES;
      } else {
        marketIds = [params.marketId];
      }
      break;
  }

  const vaults = await Promise.all(vaultAddresses.map((vaultAddress) => fetchVault(vaultAddress, publicClient)));

  // Add markets from the vault queues
  marketIds = marketIds.concat(values(vaults).flatMap((vault) => vault?.supplyQueue.concat(vault.withdrawQueue) ?? []));

  const userAddresses = [accountAddress, bundler3.generalAdapter1, ...vaultAddresses];

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
    case "vault-supply":
    case "vault-withdraw":
      tokenAddresses = [vaults[0].asset, vaults[0].address]; // Underliying and the vault share token move
      break;
    case "market-repay-withdraw":
    case "market-supply-borrow":
      tokenAddresses = [markets[0].params.loanToken, markets[0].params.collateralToken];
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

  console.log("DEBUG RAW", holdings);

  // Accrue interest on all markets
  const accruedMarkets = markets.map((market) => market.accrueInterest(block.timestamp));

  const simulationState = new SimulationState({
    chainId: CHAIN_ID,
    block,
    global: { feeRecipient: zeroAddress }, // TODO ?
    markets: Object.fromEntries(marketIds.map((marketId, i) => [marketId, accruedMarkets[i]])),
    users: Object.fromEntries(userAddresses.map((userAddress, i) => [userAddress, users[i]])),
    tokens: Object.fromEntries(tokenAddresses.map((tokenAddress, i) => [tokenAddress, tokens[i]])),
    vaults: Object.fromEntries(vaultAddresses.map((vaultAddress, i) => [vaultAddress, vaults[i]])),

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
