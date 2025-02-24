import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { cache } from "react";
import { Address } from "viem";

const query = graphql(`
  query getUserRewards($chainId: Number!, $address: String!) {
    merklUserRewards(chainId: $chainId, userAddress: $address) {
      rewards {
        token {
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

export const getUserRewards = cache(async (address: Address) => {
  console.debug("getUserRewards");
  //   const userRewards = await whiskClient.request(query, { chainId: CHAIN_ID, address });
  const userRewards = await whiskClient.request(query, { chainId: 1, address });
  return userRewards.merklUserRewards?.rewards.filter((r) => r.token && (r.unclaimedAmountUsd ?? 0) > 0);
});

export type UserRewards = Awaited<ReturnType<typeof getUserRewards>>;
