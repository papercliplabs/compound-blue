import "server-only";
import { CHAIN_ID, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";

import { whiskClient } from "./client";

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
        ...TokenConfigFragment
        priceUsd
      }
      ownerAddress
      supplyAssetsUsd
      liquidityAssetsUsd
      supplyApy {
        base
        total
        rewards {
          asset {
            ...TokenConfigFragment
          }
          apr
        }
        performanceFee
      }
      performanceFee
      marketAllocations {
        market {
          collateralAsset {
            ...TokenConfigFragment
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
