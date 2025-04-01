import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { Address } from "viem";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { MarketIdentifierInput } from "@/generated/gql/whisk/graphql";

const query = graphql(`
  query getAaveV3MarketPosition($marketIdentifier: MarketIdentifierInput!, $accountAddress: String!) {
    aaveV3MarketPosition(marketIdentifier: $marketIdentifier, accountAddress: $accountAddress) {
      healthFactor
      totalBorrowBalanceUsd
      reservePositions {
        reserve {
          underlyingAsset {
            icon
            symbol
            address
            decimals
            priceUsd
          }
          aToken {
            address
            decimals
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
