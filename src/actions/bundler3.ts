import { BundlerCall, bundler3Abi, paraswapAdapterAbi } from "@morpho-org/bundler-sdk-viem";
import { Address, Hex, encodeFunctionData, zeroHash } from "viem";

import { ParaswapOffsets } from "@/data/paraswap/types";
import { BUNDLER3_ADDRESS, PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";

export function paraswapBuy(
  augustus: Address,
  calldata: Hex,
  srcToken: Address,
  destToken: Address,
  offsets: ParaswapOffsets,
  receiver: Address
): BundlerCall[] {
  return [
    {
      to: PARASWAP_ADAPTER_ADDRESS,
      data: encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: "buy",
        args: [augustus, calldata, srcToken, destToken, BigInt(0), offsets, receiver],
      }),
      value: BigInt(0),
      skipRevert: false,
      callbackHash: zeroHash,
    },
  ];
}

export function createBundle(calls: BundlerCall[]) {
  const value = calls.reduce((acc, call) => acc + call.value, 0n);
  return {
    to: BUNDLER3_ADDRESS,
    value,
    data: encodeFunctionData({
      abi: bundler3Abi,
      functionName: "multicall",
      args: [calls],
    }),
  };
}
