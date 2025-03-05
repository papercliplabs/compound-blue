import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getVaultSummary($chainId: Number!, $address: String!) {
    morphoVault(chainId: $chainId, address: $address) {
      vaultAddress
      name
      metadata {
        image
        riskTier
      }
      asset {
        symbol
        icon
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
  const vaultSummaries = await Promise.all(
    WHITELISTED_VAULT_ADDRESSES.map((address) => whiskClient.request(query, { chainId: CHAIN_ID, address }))
  );
  return vaultSummaries.filter((summary) => summary.morphoVault).map((summary) => summary.morphoVault!);
}, "getVaultSummaries");

export type VaultSummary = NonNullable<Awaited<ReturnType<typeof getVaultSummaries>>>[number];
