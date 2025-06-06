import "server-only";
import { Address } from "viem";

import { cacheAndCatch } from "@/data/cacheAndCatch";
import { graphql } from "@/generated/gql/whisk";
import { GetAccountIsOfacSanctionedQuery } from "@/generated/gql/whisk/graphql";

import { whiskClient } from "./client";

const query = graphql(`
  query getAccountIsOfacSanctioned($address: String!) {
    identity(address: $address) {
      isOfacSanctioned
    }
  }
`);

export const getAccountIsOfacSanctioned = cacheAndCatch(async (address: Address) => {
  const isOfacSanctioned = await whiskClient.request<GetAccountIsOfacSanctionedQuery>(query, { address });
  return isOfacSanctioned.identity.isOfacSanctioned;
}, "getAccountIsOfacSanctioned");
