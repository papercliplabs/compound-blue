import "server-only";
import { Address, getAddress } from "viem";

import { CHAIN_ID, MERKL_REWARD_TOKEN_ADDRESSES } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";

import { whiskClient } from "./client";

const query = graphql(`
  query getAccountRewards($chainId: Number!, $address: String!) {
    merklAccountRewards(chainId: $chainId, accountAddress: $address) {
      rewards {
        token {
          ...TokenConfigFragment
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
  return accountRewards.merklAccountRewards?.rewards.filter(
    (r) =>
      r.token && MERKL_REWARD_TOKEN_ADDRESSES.includes(getAddress(r.token.address)) && (r.unclaimedAmountUsd ?? 0) > 0
  );
}, "getAccountRewards");

export type AccountRewards = NonNullable<Awaited<ReturnType<typeof getAccountRewards>>>;
