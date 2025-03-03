import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID } from "@/config";
import { Address } from "viem";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getAccountTokenHolding($chainId: Number!, $tokenAddress: String!, $accountAddress: String!) {
    tokenHolding(chainId: $chainId, tokenAddress: $tokenAddress, accountAddress: $accountAddress) {
      token {
        symbol
        decimals
        icon
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
