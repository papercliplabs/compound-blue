import { Address, Hex } from "viem";

import { SUPPORTED_CONTRACT_METHODS } from "./config";

export interface ParaswapOffsets {
  exactAmount: bigint;
  limitAmount: bigint;
  quotedAmount: bigint;
}

export interface ParaswapBaseTxPayload {
  augustus: Address;
  calldata: Hex;
  offsets: ParaswapOffsets;
}

export type SupportedContractMethod = (typeof SUPPORTED_CONTRACT_METHODS)[number];
