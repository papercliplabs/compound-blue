import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { Address } from "viem";
import { CHAIN_ID } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getAccountRewards($chainId: Number!, $address: String!) {
    merklAccountRewards(chainId: $chainId, accountAddress: $address) {
      rewards {
        token {
          address
          symbol
          icon
          decimals
        }
        amount
        proof

        unclaimedAmount
        unclaimedAmountUsd
      }
    }
  }
`);

export const getAccountRewards = cacheAndCatch(async (address: Address) => {
  const accountRewards = await whiskClient.request(query, { chainId: CHAIN_ID, address });
  return accountRewards.merklAccountRewards?.rewards.filter((r) => r.token && (r.unclaimedAmountUsd ?? 0) > 0);
}, "getAccountRewards");

export type AccountRewards = NonNullable<Awaited<ReturnType<typeof getAccountRewards>>>;
