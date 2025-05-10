import { CHAIN_ID, WHITELISTED_MARKET_IDS } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";

import { whiskClient } from "./client";

const query = graphql(`
  query getMarketSummary($chainId: Number!, $marketIds: [String!]!) {
    morphoMarkets(chainId: $chainId, marketIds: $marketIds) {
      marketId
      name
      isIdle
      collateralAsset {
        ...TokenConfigFragment
        priceUsd
      }
      loanAsset {
        ...TokenConfigFragment
        priceUsd
      }
      lltv
      borrowApy {
        base
        total
        rewards {
          asset {
            ...TokenConfigFragment
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
      collateralPriceInLoanAsset
    }
  }
`);

export const getMarketSummaries = cacheAndCatch(async () => {
  const marketSummaries = await whiskClient.request(query, { chainId: CHAIN_ID, marketIds: WHITELISTED_MARKET_IDS });
  return marketSummaries.morphoMarkets.filter((summary) => !summary.isIdle && !!summary.collateralAsset);
}, "getMarketSummaries");

type MarketSummaryWithIdle = NonNullable<Awaited<ReturnType<typeof getMarketSummaries>>>[number];
export type MarketSummary = MarketSummaryWithIdle & {
  isIdle: false;
  collateralAsset: NonNullable<MarketSummaryWithIdle["collateralAsset"]>;
};
