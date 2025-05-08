import { ChainId } from "@morpho-org/blue-sdk";
import { BundlerCall, bundler3Abi, generalAdapter1Abi, paraswapAdapterAbi } from "@morpho-org/bundler-sdk-viem";
import { Address, Hex, encodeAbiParameters, encodeFunctionData, keccak256, zeroHash } from "viem";

import { ParaswapOffsets } from "@/actions/data/paraswap/types";
import { BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS, PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";

const reenterAbiInputs = bundler3Abi.find((item) => item.name === "reenter")!.inputs;

// Current a bug in the Morpho SDK with how the enter data is encoded
// https://github.com/morpho-org/sdks/blob/main/packages/bundler-sdk-viem/src/BundlerAction.ts#L1338-L1342
export function morphoFlashLoan(
  _chainId: ChainId,
  asset: Address,
  amount: bigint,
  callbackCalls: BundlerCall[],
  skipRevert = false
): BundlerCall[] {
  const reenter = callbackCalls.length > 0;
  const reenterData = reenter ? encodeAbiParameters(reenterAbiInputs, [callbackCalls]) : "0x";

  return [
    {
      to: GENERAL_ADAPTER_1_ADDRESS,
      data: encodeFunctionData({
        abi: generalAdapter1Abi,
        functionName: "morphoFlashLoan",
        args: [asset, amount, reenterData],
      }),
      value: 0n,
      skipRevert,
      callbackHash: reenter ? keccak256(reenterData) : zeroHash,
    },
  ];
}

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
