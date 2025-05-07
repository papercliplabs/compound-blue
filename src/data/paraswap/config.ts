import { ContractMethodV6 } from "@paraswap/sdk";

import { SupportedContractMethod } from "./types";
import { ParaswapOffsets } from "./types";

export const SUPPORTED_CONTRACT_METHODS = [ContractMethodV6.swapExactAmountOut] as const;

// https://api.paraswap.io/adapters/list/1
export const SUPPORTED_DEXS = [
  "Bancor",
  "DODOV2",
  "UniswapV2",
  "PancakeSwapV2",
  "UniswapV3",
  "SushiSwapV3",
  "CurveV2",
  "SushiSwap",
  "AugustusRFQ",
  "Lido",
  "EtherFi",
  "Swerve",
  "DefiSwap",
  "LinkSwap",
  "ShibaSwap",
  "Verse",
  "MakerPsm",
  "Synapse",
  "MaverickV1",

  // Exlcude these for now - don't need lending protocols, and less know/liquid DEXs, or ones not even on Polygon
  // "SwaapV2",
  // "wstETH",
  // "Hashflow",
  // "Synthetix",
  // "Smoothy",
  // "TraderJoeV2.1",
  // "CurveV1",
  // "DODOV1",
  // "CurveV1Factory",
  // "CurveV1StableNg",
  // "KyberDmm",
  // "PolygonMigrator",
  // "Compound",
  // "AaveV2",
  // "AaveV3",
  // "SolidlyV2",
  // "AngleStakedStableUSD",
  // "AngleStakedStableEUR",
  // "sUSDS",

  // "ParaSwapLimitOrders", // Don't allow limit orders

  // All the following throw an error when used "CERT_HAS_EXPIRED", messaged paraswap team
  // "BalancerV1",
  // "BalancerV2",
  // "Swell",
  // "SolidlyV3",
  // "Spark",
  // "Weth",
  // "Wombat",
  // "PancakeswapV3",
] as const;

export const OFFSET_LOOKUP_TABLE: Record<SupportedContractMethod, ParaswapOffsets> = {
  [ContractMethodV6.swapExactAmountOut]: {
    exactAmount: BigInt(4 + 4 * 32),
    limitAmount: BigInt(4 + 3 * 32),
    quotedAmount: BigInt(4 + 5 * 32),
  },

  // Other offsets which are not used (leaving for future if needed)
  // [ContractMethodV6.swapExactAmountIn]: {
  //   exactAmount: BigInt(4 + 3 * 32),
  //   limitAmount: BigInt(4 + 4 * 32),
  //   quotedAmount: BigInt(4 + 5 * 32),
  // },
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
