import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_MARKET_IDS } from "@/config";
import { cache } from "react";

const query = graphql(`
  query getMarketSummary($chainId: Number!, $marketId: String!) {
    morphoMarket(chainId: $chainId, marketId: $marketId) {
      marketId
      collateralAsset {
        symbol
        icon
      }
      loanAsset {
        symbol
        icon
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
      supplyAssetsUsd
      liquidityAssetsUsd
      borrowAssetsUsd
      utilization
    }
  }
`);

export const getMarketSummaries = cache(async () => {
  const marketSummaries = await Promise.all(
    WHITELISTED_MARKET_IDS.map((marketId) => whiskClient.request(query, { chainId: CHAIN_ID, marketId }))
  );
  return marketSummaries.filter((summary) => summary.morphoMarket).map((summary) => summary.morphoMarket!);
});

export type MarketSummary = Awaited<ReturnType<typeof getMarketSummaries>>[number];
