import "server-only";
import { Address } from "viem";

import { CHAIN_ID, WHITELISTED_MARKET_IDS } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";

import { whiskClient } from "./client";

const query = graphql(`
  query getMarketPositions($chainId: Number!, $marketIds: [String!]!, $accountAddress: String!) {
    morphoMarketPositions(chainId: $chainId, marketIds: $marketIds, accountAddress: $accountAddress) {
      market {
        marketId

        # Used for aggregation
        borrowApy {
          total
        }
      }
      collateralAssets
      collateralAssetsUsd

      supplyAssetsUsd

      borrowAssets
      borrowAssetsUsd

      maxBorrowAssetsUsd
      maxBorrowAssets

      ltv
    }
  }
`);

export const getAccountMarketPositions = cacheAndCatch(async (accountAddress: Address) => {
  const marketPositions = await whiskClient.request(query, {
    chainId: CHAIN_ID,
    marketIds: WHITELISTED_MARKET_IDS,
    accountAddress,
  });

  return Object.fromEntries(
    marketPositions.morphoMarketPositions.map((position) => [position.market.marketId, position])
  );
}, "getUserMarketPositions");

export type AccountMarketPositions = NonNullable<Awaited<ReturnType<typeof getAccountMarketPositions>>>;
export type AccountMarketPosition = AccountMarketPositions[number];
