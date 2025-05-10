import "server-only";
import { Address } from "viem";

import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";
import { MarketIdentifierInput } from "@/generated/gql/whisk/graphql";

import { whiskClient } from "./client";

const query = graphql(`
  query getAaveV3MarketPosition($marketIdentifier: MarketIdentifierInput!, $accountAddress: String!) {
    aaveV3MarketPosition(marketIdentifier: $marketIdentifier, accountAddress: $accountAddress) {
      healthFactor
      totalBorrowBalanceUsd
      totalCollateralBalanceUsd
      lltv
      ltv
      reservePositions {
        lltvEffective
        reserve {
          underlyingAsset {
            ...TokenConfigFragment
            priceUsd
          }
          aToken {
            ...TokenConfigFragment
          }
          supplyApy {
            total
          }
          borrowApy {
            total
          }
          lltv
        }
        isUsageAsCollateralEnabled
        aTokenAssets
        aTokenAssetsUsd
        borrowAssets
        borrowAssetsUsd
      }
    }
  }
`);

export const getAaveV3MarketPosition = cacheAndCatch(async (accountAddress: Address) => {
  const aaveV3MarketPosition = await whiskClient.request(query, {
    marketIdentifier: MarketIdentifierInput.PolygonCore,
    accountAddress,
  });
  return aaveV3MarketPosition.aaveV3MarketPosition;
}, "getAaveV3MarketPosition");

export type AaveV3MarketPosition = NonNullable<Awaited<ReturnType<typeof getAaveV3MarketPosition>>>;
export type AaveV3ReservePosition = NonNullable<
  Awaited<ReturnType<typeof getAaveV3MarketPosition>>
>["reservePositions"][number];
