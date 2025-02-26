import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { Hex } from "viem";
import { CHAIN_ID } from "@/config";
import { cache } from "react";

const query = graphql(`
  query getMarket($chainId: Number!, $marketId: String!) {
    morphoMarket(chainId: $chainId, marketId: $marketId) {
      marketId
      name
      collateralAsset {
        priceUsd
        address
        decimals
        symbol
        icon
      }
      lltv
      liquidationPenalty
      loanAsset {
        address
        decimals
        priceUsd
        symbol
        icon
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
            symbol
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
          curatorAddress
          name
          metadata {
            image
          }
          asset {
            symbol
            icon
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

export const getMarket = cache(async (marketId: Hex) => {
  console.debug("getMarket", marketId);
  const market = await whiskClient.request(query, { chainId: CHAIN_ID, marketId });
  return market.morphoMarket ?? null;
});

export type Market = NonNullable<Awaited<ReturnType<typeof getMarket>>>;
