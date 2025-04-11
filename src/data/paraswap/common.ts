import { ContractMethodV6 } from "@paraswap/sdk";
import { Address, Hex } from "viem";

export interface ParaswapOffsets {
  exactAmount: bigint;
  limitAmount: bigint;
  quotedAmount: bigint;
}

export const SUPPORTED_CONTRACT_METHODS = [
  ContractMethodV6.swapExactAmountIn,
  ContractMethodV6.swapExactAmountOut,
  //   ContractMethodV6.swapExactAmountInOnUniswapV2,
  //   ContractMethodV6.swapExactAmountOutOnUniswapV2,
  //   ContractMethodV6.swapExactAmountInOnUniswapV3,
  //   ContractMethodV6.swapExactAmountOutOnUniswapV3,
  //   ContractMethodV6.swapExactAmountInOnBalancerV2,
  //   ContractMethodV6.swapExactAmountOutOnBalancerV2,
  //   ContractMethodV6.swapExactAmountInOnCurveV1,
  //   ContractMethodV6.swapExactAmountInOnCurveV2,
  //   ContractMethodV6.swapExactAmountInOnCurveV1,
] as const;
export type SupportedContractMethod = (typeof SUPPORTED_CONTRACT_METHODS)[number];

export const OFFSET_LOOKUP_TABLE: Record<SupportedContractMethod, ParaswapOffsets> = {
  [ContractMethodV6.swapExactAmountIn]: {
    exactAmount: BigInt(4 + 3 * 32),
    limitAmount: BigInt(4 + 4 * 32),
    quotedAmount: BigInt(4 + 5 * 32),
  },
  [ContractMethodV6.swapExactAmountOut]: {
    exactAmount: BigInt(4 + 4 * 32),
    limitAmount: BigInt(4 + 3 * 32),
    quotedAmount: BigInt(4 + 5 * 32),
  },
};

export interface GetParaswapReturnType {
  augustus: Address;
  calldata: Hex;
  offsets: ParaswapOffsets;
}
