import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_MARKET_IDS } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getMarketSummary($chainId: Number!, $marketIds: [String!]!) {
    morphoMarkets(chainId: $chainId, marketIds: $marketIds) {
      marketId
      name
      isIdle
      collateralAsset {
        symbol
        icon
        address
      }
      loanAsset {
        symbol
        icon
        address
      }
      lltv
      borrowApy {
        base
        total
        rewards {
          asset {
            symbol
            icon
          }
          apr
        }
      }
      supplyAssets
      supplyAssetsUsd
      liquidityAssetsUsd
      publicAllocatorSharedLiquidityAssetsUsd
      borrowAssets
      borrowAssetsUsd
      utilization
      vaultAllocations {
        vault {
          vaultAddress
        }
      }
    }
  }
`);

export const getMarketSummaries = cacheAndCatch(async () => {
  const marketSummaries = await whiskClient.request(query, { chainId: CHAIN_ID, marketIds: WHITELISTED_MARKET_IDS });
  return marketSummaries.morphoMarkets.filter((summary) => !summary.isIdle);
}, "getMarketSummaries");

export type MarketSummary = NonNullable<Awaited<ReturnType<typeof getMarketSummaries>>>[number];
