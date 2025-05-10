import { graphql } from "@/generated/gql/whisk";
import { TokenConfigFragmentFragment } from "@/generated/gql/whisk/graphql";

graphql(`
  fragment TokenConfigFragment on Token {
    address
    symbol
    decimals
    icon
  }
`);

// Some cleaner type names
export type TokenConfig = TokenConfigFragmentFragment;
