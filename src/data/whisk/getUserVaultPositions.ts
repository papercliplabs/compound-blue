import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { cache } from "react";
import { Address } from "viem";

const query = graphql(`
  query getVaultPosition($chainId: Number!, $vaultAddress: String!, $accountAddress: String!) {
    morphoVaultPosition(chainId: $chainId, vaultAddress: $vaultAddress, accountAddress: $accountAddress) {
      vaultAddress
      asset {
        symbol
        icon
        decimals
      }
      supplyAssets
      supplyAssetsUsd
      supplyApy {
        total
        base
        rewards {
          asset {
            symbol
            icon
          }
          apr
        }
        performanceFee
      }
    }
  }
`);

export const getUserVaultPositions = cache(async (accountAddress: Address) => {
  console.debug("getUserVaultPositions");
  const vaultPositions = await Promise.all(
    WHITELISTED_VAULT_ADDRESSES.map((vaultAddress) =>
      whiskClient.request(query, { chainId: CHAIN_ID, vaultAddress, accountAddress })
    )
  );
  return Object.fromEntries(
    vaultPositions
      .filter((position) => position.morphoVaultPosition)
      .map((position) => [position.morphoVaultPosition!.vaultAddress, position.morphoVaultPosition!])
  );
});

export type UserVaultPositions = Awaited<ReturnType<typeof getUserVaultPositions>>;
