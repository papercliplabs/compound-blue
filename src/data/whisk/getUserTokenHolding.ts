import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { CHAIN_ID } from "@/config";
import { cache } from "react";
import { Address } from "viem";

const query = graphql(`
  query getUserTokenHolding($chainId: Number!, $tokenAddress: String!, $accountAddress: String!) {
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

export const getUserTokenHolding = cache(async (tokenAddress: Address, accountAddress: Address) => {
  console.debug("getUserTokenHolding");
  const tokenHoldings = await whiskClient.request(query, { chainId: CHAIN_ID, tokenAddress, accountAddress });
  return tokenHoldings.tokenHolding;
});

export type UserTokenHolding = Awaited<ReturnType<typeof getUserTokenHolding>>;
