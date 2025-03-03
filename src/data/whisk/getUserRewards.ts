import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { Address } from "viem";
import { CHAIN_ID } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getUserRewards($chainId: Number!, $address: String!) {
    merklUserRewards(chainId: $chainId, userAddress: $address) {
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

export const getUserRewards = cacheAndCatch(async (address: Address) => {
  const userRewards = await whiskClient.request(query, { chainId: CHAIN_ID, address });
  return userRewards.merklUserRewards?.rewards.filter((r) => r.token && (r.unclaimedAmountUsd ?? 0) > 0);
}, "getUserRewards");

export type UserRewards = NonNullable<Awaited<ReturnType<typeof getUserRewards>>>;
