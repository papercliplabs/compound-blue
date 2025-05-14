import { ContractMethodV6, constructSimpleSDK } from "@paraswap/sdk";

import { CHAIN_ID } from "@/config";

import { SupportedContractMethod } from "./types";
import { ParaswapOffsets } from "./types";

export const paraswapSdk = constructSimpleSDK({
  chainId: CHAIN_ID,
  fetch,
  version: "6.2",
});

// Most assets are blue chip with good liquidity, so we can be more aggressive here then default 15%
export const PARASWAP_MAX_PRICE_IMPACT_PCT = 2;

export const SUPPORTED_CONTRACT_METHODS = [
  ContractMethodV6.swapExactAmountOut,
  ContractMethodV6.swapExactAmountIn,
] as const;

export const OFFSET_LOOKUP_TABLE: Record<SupportedContractMethod, ParaswapOffsets> = {
  [ContractMethodV6.swapExactAmountOut]: {
    exactAmount: BigInt(4 + 4 * 32),
    limitAmount: BigInt(4 + 3 * 32),
    quotedAmount: BigInt(4 + 5 * 32),
  },
  [ContractMethodV6.swapExactAmountIn]: {
    exactAmount: BigInt(4 + 3 * 32),
    limitAmount: BigInt(4 + 4 * 32),
    quotedAmount: BigInt(4 + 5 * 32),
  },

  // Other offsets which are not used (leaving for future if needed)

  // [ContractMethodV6.swapExactAmountOutOnUniswapV2]: {
  //   exactAmount: BigInt(4 + 3 * 32),
  //   limitAmount: BigInt(4 + 2 * 32),
  //   quotedAmount: BigInt(4 + 4 * 32),
  // },
  // [ContractMethodV6.swapExactAmountOutOnUniswapV3]: {
  //   exactAmount: BigInt(4 + 3 * 32),
  //   limitAmount: BigInt(4 + 2 * 32),
  //   quotedAmount: BigInt(4 + 4 * 32),
  // },
  // [ContractMethodV6.swapExactAmountOutOnBalancerV2]: {
  //   exactAmount: BigInt(4 + 0 * 32),
  //   limitAmount: BigInt(4 + 1 * 32),
  //   quotedAmount: BigInt(4 + 2 * 32),
  // },
};

// Paraswap has a routing bug using Uniswap V4, they are working on a fix but we need to exclude it for now
export const PARASWAP_EXCLUDE_DEXS = ["UniswapV4"];
