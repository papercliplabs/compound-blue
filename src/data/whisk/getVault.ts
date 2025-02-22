import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { Address } from "viem";
import { CHAIN_ID } from "@/config";

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

export async function getVault(address: Address) {
  console.debug("getVault", address);
  const vault = await whiskClient.request(query, { chainId: CHAIN_ID, address });
  return vault.morphoVault ?? null;
}
