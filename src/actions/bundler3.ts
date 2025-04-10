import { CHAIN_ID } from "@/config";
import { Address, encodeAbiParameters, encodeFunctionData, Hex, keccak256, zeroHash } from "viem";
import { addresses, ChainId, InputMarketParams } from "@morpho-org/blue-sdk";
import { bundler3Abi, BundlerCall, generalAdapter1Abi, paraswapAdapterAbi } from "@morpho-org/bundler-sdk-viem";
import { ParaswapOffsets } from "@/data/paraswap/common";

const {
  bundler3: {
    paraswapAdapter: paraswapAdapterAddress,
    bundler3: bundler3Address,
    generalAdapter1: generalAdapter1Address,
  },
} = addresses[CHAIN_ID];

export function paraswapBuy(
  augustus: Address,
  calldata: Hex,
  srcToken: Address,
  destToken: Address,
  offsets: ParaswapOffsets,
  receiver: Address
): BundlerCall[] {
  if (!paraswapAdapterAddress) {
    throw new Error("Paraswap adapter not found");
  }

  return [
    {
      to: paraswapAdapterAddress,
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
  if (!paraswapAdapterAddress) {
    throw new Error("Paraswap adapter not found");
  }

  return [
    {
      to: paraswapAdapterAddress,
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
  if (!paraswapAdapterAddress) {
    throw new Error("Paraswap adapter not found");
  }

  return [
    {
      to: paraswapAdapterAddress,
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

const reenterAbiInputs = bundler3Abi.find((item) => item.name === "reenter")!.inputs;

// https://github.com/morpho-org/sdks/blob/next/packages/bundler-sdk-viem/src/BundlerAction.ts#L1049
// Not using Morpho's SDK here since it doesn't give control over skipRevert which we use for the sweep
export function morphoSupplyCollateral(
  _chainId: ChainId, // To conform to SDK to plug back out later
  market: InputMarketParams,
  assets: bigint,
  onBehalf: Address,
  callbackCalls: BundlerCall[],
  skipRevert: boolean = false
): BundlerCall[] {
  const reenter = callbackCalls.length > 0;
  const reenterData = reenter ? encodeAbiParameters(reenterAbiInputs, [callbackCalls]) : "0x";

  return [
    {
      to: generalAdapter1Address,
      data: encodeFunctionData({
        abi: generalAdapter1Abi,
        functionName: "morphoSupplyCollateral",
        args: [market, assets, onBehalf, reenterData],
      }),
      value: BigInt(0),
      skipRevert,
      callbackHash: reenter ? keccak256(reenterData) : zeroHash,
    },
  ];
}

// https://github.com/morpho-org/sdks/blob/next/packages/bundler-sdk-viem/src/BundlerAction.ts#L1049
// Not using Morpho's SDK here since it doesn't give control over skipRevert which we use for the sweep
export function morphoRepay(
  _chainId: ChainId, // To conform to SDK to plug back out later
  market: InputMarketParams,
  assets: bigint,
  shares: bigint,
  slippageAmount: bigint,
  onBehalf: Address,
  callbackCalls: BundlerCall[],
  skipRevert = false
): BundlerCall[] {
  const reenter = callbackCalls.length > 0;
  const reenterData = reenter ? encodeAbiParameters(reenterAbiInputs, [callbackCalls]) : "0x";

  return [
    {
      to: generalAdapter1Address,
      data: encodeFunctionData({
        abi: generalAdapter1Abi,
        functionName: "morphoRepay",
        args: [market, assets, shares, slippageAmount, onBehalf, reenterData],
      }),
      value: BigInt(0),
      skipRevert,
      callbackHash: reenter ? keccak256(reenterData) : zeroHash,
    },
  ];
}

export function createBundle(calls: BundlerCall[]) {
  return {
    to: bundler3Address,
    value: BigInt(0),
    data: encodeFunctionData({
      abi: bundler3Abi,
      functionName: "multicall",
      args: [calls],
    }),
  };
}
