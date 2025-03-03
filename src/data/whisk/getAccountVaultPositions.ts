import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { Address } from "viem";
import { cacheAndCatch } from "@/data/cacheAndCatch";

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

export const getAccountVaultPositions = cacheAndCatch(async (accountAddress: Address) => {
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
}, "getAccountVaultPositions");

export type AccountVaultPositions = NonNullable<Awaited<ReturnType<typeof getAccountVaultPositions>>>;
