import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { cache } from "react";

const query = graphql(`
  query getVaultSummary($chainId: Number!, $address: String!) {
    morphoVault(chainId: $chainId, address: $address) {
      vaultAddress
      name
      metadata {
        image
      }
      asset {
        symbol
        icon
      }
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

export const getVaultSummaries = cache(async () => {
  console.debug("getVaultSummaries");
  const vaultSummaries = await Promise.all(
    WHITELISTED_VAULT_ADDRESSES.map((address) => whiskClient.request(query, { chainId: CHAIN_ID, address }))
  );
  return vaultSummaries.filter((summary) => summary.morphoVault).map((summary) => summary.morphoVault!);
});

export type VaultSummary = Awaited<ReturnType<typeof getVaultSummaries>>[number];
