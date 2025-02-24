// import { graphql } from "@/generated/gql/whisk";
// import { whiskClient } from "./client";
// import { Hex } from "viem";
// import { CHAIN_ID } from "@/config";
// import { cache } from "react";

// const query = graphql(`
//   query getMarket($chainId: Number!, $marketId: String!) {
//     morphoMarket(chainId: $chainId, marketId: $marketId) {
//       marketId
//       name
//       collateralAsset {
//         priceUsd
//         address
//         decimals
//         symbol
//       }
//       lltv
//       loanAsset {
//         address
//         decimals
//         priceUsd
//         symbol
//       }
//       oracleAddress
//       irm {
//         address
//         targetUtilization
//       }
//       supplyAssets
//       supplyAssetsUsd
//       borrowAssets
//       borrowAssetsUsd
//       utilization
//       collateralPriceInLoanAsset
//       borrowApy {
//         base
//         total
//         rewards {
//           apr
//           asset {
//             symbol
//             priceUsd
//           }
//         }
//       }
//       supplyApy {
//         base
//         rewards {
//           apr
//         }
//         total
//       }
//     }
//   }
// `);

// export const getPosition = cache(async (add: Hex) => {
//   console.debug("getMarket", marketId);
//   const market = await whiskClient.request(query, { chainId: CHAIN_ID, marketId });
//   return market.morphoMarket ?? null;
// });
