import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID, WHITELISTED_VAULT_ADDRESSES } from "@/config";
import { Address } from "viem";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getVaultPositions($chainId: Number!, $vaultAddresses: [String!]!, $accountAddress: String!) {
    morphoVaultPositions(chainId: $chainId, vaultAddresses: $vaultAddresses, accountAddress: $accountAddress) {
      vault {
        vaultAddress

        # Used for aggregation
        supplyApy {
          total
        }
      }

      supplyAssets
      supplyAssetsUsd
    }
  }
`);

export const getAccountVaultPositions = cacheAndCatch(async (accountAddress: Address) => {
  const accountVaultPositions = await whiskClient.request(query, {
    chainId: CHAIN_ID,
    vaultAddresses: WHITELISTED_VAULT_ADDRESSES,
    accountAddress,
  });
  return Object.fromEntries(
    accountVaultPositions.morphoVaultPositions.map((position) => [position.vault.vaultAddress, position])
  );
}, "getAccountVaultPositions");

export type AccountVaultPositions = NonNullable<Awaited<ReturnType<typeof getAccountVaultPositions>>>;
export type AccountVaultPosition = AccountVaultPositions[number];
