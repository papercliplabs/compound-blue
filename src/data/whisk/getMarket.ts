import { Hex } from "viem";

import { CHAIN_ID } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";
import { GetMarketQuery } from "@/generated/gql/whisk/graphql";

import { whiskClient } from "./client";

const query = graphql(`
  query getMarket($chainId: Number!, $marketId: String!) {
    morphoMarket(chainId: $chainId, marketId: $marketId) {
      marketId
      isIdle
      name
      collateralAsset {
        ...TokenConfigFragment
        priceUsd
      }
      lltv
      liquidationPenalty
      loanAsset {
        ...TokenConfigFragment
        priceUsd
      }
      oracleAddress
      irm {
        address
        targetUtilization
        curve {
          utilization
          supplyApy
          borrowApy
        }
      }
      supplyAssets
      supplyAssetsUsd
      liquidityAssets
      liquidityAssetsUsd
      publicAllocatorSharedLiquidityAssetsUsd
      borrowAssets
      borrowAssetsUsd
      utilization
      collateralPriceInLoanAsset
      borrowApy {
        base
        total
        rewards {
          apr
          asset {
            ...TokenConfigFragment
            priceUsd
          }
        }
      }
      supplyApy {
        base
        rewards {
          apr
        }
        total
      }

      vaultAllocations {
        vault {
          vaultAddress
          ownerAddress
          curatorAddress
          name
          metadata {
            image
            riskTier
          }
          asset {
            ...TokenConfigFragment
          }
        }
        position {
          supplyAssetsUsd
        }
        marketSupplyShare
        supplyCapUsd
      }
    }
  }
`);

export const getMarket = cacheAndCatch(async (marketId: Hex) => {
  const market = await whiskClient.request<GetMarketQuery>(query, { chainId: CHAIN_ID, marketId });
  return market.morphoMarket;
}, "getMarket");

export type Market = NonNullable<Awaited<ReturnType<typeof getMarket>>>;

// Helpers for type checking non-idle markets
export type MarketNonIdle = Market & { isIdle: false; collateralAsset: NonNullable<Market["collateralAsset"]> };
export function isNonIdleMarket(market: Market | null): market is MarketNonIdle {
  return !!market && market.isIdle === false && !!market.collateralAsset;
}
