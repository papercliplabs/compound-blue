import "server-only";
import { graphql } from "@/generated/gql/whisk";
import { whiskClient } from "./client";
import { Address } from "viem";
import { cacheAndCatch } from "@/data/cacheAndCatch";

const query = graphql(`
  query getAccountIsOfacSanctioned($address: String!) {
    identity(address: $address) {
      isOfacSanctioned
    }
  }
`);

export const getAccountIsOfacSanctioned = cacheAndCatch(async (address: Address) => {
  const isOfacSanctioned = await whiskClient.request(query, { address });
  return isOfacSanctioned.identity.isOfacSanctioned;
}, "getAccountIsOfacSanctioned");
