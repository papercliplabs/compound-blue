import "server-only";
import { Address } from "viem";

import { CHAIN_ID } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";

import { whiskClient } from "./client";

const query = graphql(`
  query getVault($chainId: Number!, $address: String!) {
    morphoVault(chainId: $chainId, address: $address) {
      vaultAddress
      name
      decimals
      metadata {
        description
        forumLink
        image
        riskTier
      }
      feeRecipientAddress
      ownerAddress
      curatorAddress
      guardianAddress

      performanceFee

      supplyAssetsUsd
      liquidityAssetsUsd

      asset {
        address
        symbol
        icon
        decimals
        priceUsd
      }

      supplyApy {
        base
        total
        rewards {
          asset {
            symbol
            icon
          }
          apr
        }
        performanceFee
      }

      marketAllocations {
        market {
          marketId
          isIdle
          name
          lltv
          loanAsset {
            symbol
            icon
            address
          }
          collateralAsset {
            symbol
            icon
            address
          }
          supplyApy {
            total
          }
        }
        position {
          supplyAssetsUsd
        }
        vaultSupplyShare
        supplyCapUsd
      }
    }
  }
`);

export const getVault = cacheAndCatch(async (address: Address) => {
  const vault = await whiskClient.request(query, { chainId: CHAIN_ID, address });
  return vault.morphoVault ?? null;
}, "getVault");

export type Vault = NonNullable<Awaited<ReturnType<typeof getVault>>>;
