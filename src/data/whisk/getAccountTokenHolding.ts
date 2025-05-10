import "server-only";
import { Address } from "viem";

import { CHAIN_ID } from "@/config";
import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";

import { whiskClient } from "./client";

const query = graphql(`
  query getAccountTokenHolding($chainId: Number!, $tokenAddress: String!, $accountAddress: String!) {
    tokenHolding(chainId: $chainId, tokenAddress: $tokenAddress, accountAddress: $accountAddress) {
      token {
        ...TokenConfigFragment
        priceUsd
      }
      balance
      balanceUsd
    }
  }
`);

export const getAccountTokenHolding = cacheAndCatch(async (tokenAddress: Address, accountAddress: Address) => {
  const tokenHoldings = await whiskClient.request(query, { chainId: CHAIN_ID, tokenAddress, accountAddress });
  return tokenHoldings.tokenHolding;
}, "getAccountTokenHolding");

export type AccountTokenHolding = NonNullable<Awaited<ReturnType<typeof getAccountTokenHolding>>>;
