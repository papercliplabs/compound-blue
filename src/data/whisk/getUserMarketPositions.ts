import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_MARKET_IDS } from "@/config";
import { cache } from "react";
import { Address } from "viem";

const query = graphql(`
  query getMarketPosition($chainId: Number!, $marketId: String!, $accountAddress: String!) {
    morphoMarketPosition(chainId: $chainId, marketId: $marketId, accountAddress: $accountAddress) {
      market {
        marketId
        lltv
        collateralAsset {
          symbol
        }
        loanAsset {
          symbol
          decimals
          icon
        }
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

export const getUserMarketPositions = cache(async (accountAddress: Address) => {
  console.debug("getUserMarketPositions");
  const marketPositions = await Promise.all(
    WHITELISTED_MARKET_IDS.map((marketId) =>
      whiskClient.request(query, { chainId: CHAIN_ID, marketId, accountAddress })
    )
  );
  return Object.fromEntries(
    marketPositions
      .filter((position) => position.morphoMarketPosition?.market)
      .map((position) => [position.morphoMarketPosition!.market!.marketId, position.morphoMarketPosition!])
  );
});

export type UserMarketPositions = Awaited<ReturnType<typeof getUserMarketPositions>>;
