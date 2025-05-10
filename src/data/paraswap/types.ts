import { Address, Hex } from "viem";

import { SUPPORTED_CONTRACT_METHODS, SUPPORTED_DEXS } from "./config";

export interface ParaswapOffsets {
  exactAmount: bigint;
  limitAmount: bigint;
  quotedAmount: bigint;
}

export interface GetParaswapReturnType {
  augustus: Address;
  calldata: Hex;
  offsets: ParaswapOffsets;
}

export type SupportedContractMethod = (typeof SUPPORTED_CONTRACT_METHODS)[number];

export type SupportedDex = (typeof SUPPORTED_DEXS)[number];
