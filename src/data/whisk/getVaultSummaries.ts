import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getVaultSummarys($chainId: Number!, $addresses: [String!]!) {
    morphoVaults(chainId: $chainId, addresses: $addresses) {
      vaultAddress
      name
      metadata {
        image
        riskTier
      }
      asset {
        symbol
        icon
        address
      }
      ownerAddress
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
        performanceFee
      }
      performanceFee
      marketAllocations {
        market {
          collateralAsset {
            icon
            symbol
          }
        }
      }
    }
  }
`);

export const getVaultSummaries = cacheAndCatch(async () => {
  const vaultSummaries = await whiskClient.request(query, {
    chainId: CHAIN_ID,
    addresses: WHITELISTED_VAULT_ADDRESSES,
  });
  return vaultSummaries.morphoVaults;
}, "getVaultSummaries");

export type VaultSummary = NonNullable<Awaited<ReturnType<typeof getVaultSummaries>>>[number];
