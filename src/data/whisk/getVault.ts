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
          name
          lltv
          loanAsset {
            symbol
            icon
          }
          collateralAsset {
            symbol
            icon
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

export const getVault = cache(async (address: Address) => {
  console.debug("getVault", address);
  const vault = await whiskClient.request(query, { chainId: CHAIN_ID, address });
  return vault.morphoVault ?? null;
});

export type Vault = NonNullable<Awaited<ReturnType<typeof getVault>>>;
