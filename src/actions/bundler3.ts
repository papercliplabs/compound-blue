import { Address, encodeFunctionData, Hex, zeroHash } from "viem";
import { InputMarketParams } from "@morpho-org/blue-sdk";
import { bundler3Abi, BundlerCall, paraswapAdapterAbi } from "@morpho-org/bundler-sdk-viem";
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

// Buy exact amount of debt
export function paraswapBuyDebt(
  augustus: Address,
  calldata: Hex,
  srcToken: Address,
  marketParams: InputMarketParams,
  offsets: ParaswapOffsets,
  onBehalf: Address,
  receiver: Address
): BundlerCall[] {
  return [
    {
      to: PARASWAP_ADAPTER_ADDRESS,
      data: encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: "buyMorphoDebt",
        args: [augustus, calldata, srcToken, marketParams, offsets, onBehalf, receiver],
      }),
      value: BigInt(0),
      skipRevert: false,
      callbackHash: zeroHash,
    },
  ];
}

export function paraswapSell(
  augustus: Address,
  calldata: Hex,
  srcToken: Address,
  destToken: Address,
  sellEntireBalance: boolean,
  offsets: ParaswapOffsets,
  receiver: Address
): BundlerCall[] {
  return [
    {
      to: PARASWAP_ADAPTER_ADDRESS,
      data: encodeFunctionData({
        abi: paraswapAdapterAbi,
        functionName: "sell",
        args: [augustus, calldata, srcToken, destToken, sellEntireBalance, offsets, receiver],
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
