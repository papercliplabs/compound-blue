import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { Address } from "viem";
import { CHAIN_ID } from "@/config";
import { cache } from "react";

const query = graphql(`
  query getVault($chainId: Number!, $address: String!) {
    morphoVault(chainId: $chainId, address: $address) {
      vaultAddress
      name
      metadata {
        description
        forumLink
        image
      }
      guardianAddress
      performanceFee
      supplyAssetsUsd
      liquidityAssetsUsd

      asset {
        symbol
        icon
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
          name
          lltv
          collateralAsset {
            name
            symbol
          }
          supplyApy {
            total
          }
        }
        position {
          supplyAssetsUsd
        }
        vaultSupplyShare
      }
    }
  }
`);

export const getVault = cache(async (address: Address) => {
  console.debug("getVault", address);
  const vault = await whiskClient.request(query, { chainId: CHAIN_ID, address });
  return vault.morphoVault ?? null;
});
