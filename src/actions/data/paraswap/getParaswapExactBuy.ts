import { ContractMethod, OptimalRate, SwapSide } from "@paraswap/sdk";
import { Address, Client, Hex, erc20Abi, getAddress, isAddressEqual } from "viem";
import { readContract } from "viem/actions";

import { computeAmountWithSlippageSurplus } from "@/actions/utils/math";
import { MAX_SLIPPAGE_TOLERANCE_LIMIT, PARASWAP_PARTNER_ADDRESS, PARASWAP_PARTNER_NAME } from "@/config";

import {
  OFFSET_LOOKUP_TABLE,
  PARASWAP_EXCLUDE_DEXS,
  PARASWAP_MAX_PRICE_IMPACT_PCT,
  PARASWAP_SUPPORTED_AGUSTUS_ADDRESS,
  SUPPORTED_CONTRACT_METHODS,
  paraswapSdk,
} from "./config";
import { ParaswapBaseTxPayload, SupportedContractMethod } from "./types";

export type ParaswapExactBuyParameters = {
  publicClient: Client;
  accountAddress: Address;

  srcTokenAddress: Address;
  destTokenAddress: Address;

  exactDestTokenAmount: bigint;
} & (
  | {
      slippageType: "max-input";
      maxSrcTokenAmount: bigint;
    }
  | {
      slippageType: "slippage";
      maxSlippage: number; // (0, MAX_SLIPPAGE_TOLERANCE_LIMIT]
    }
);

export interface ParaswapExactBuyTxPayload extends ParaswapBaseTxPayload {
  quoteSrcTokenAmount: bigint;
  maxSrcTokenAmount: bigint;
  inputs: {
    srcTokenAddress: Address;
    destTokenAddress: Address;
    exactDestTokenAmount: bigint;
  };
}

export async function getParaswapExactBuyQuote({
  publicClient,
  accountAddress,
  srcTokenAddress,
  destTokenAddress,
  exactDestTokenAmount,
}: Omit<ParaswapExactBuyParameters, "slippageType" | "maxSlippage" | "maxSrcTokenAmount">): Promise<OptimalRate> {
  const [srcTokenDecimals, destTokenDecimals] = await Promise.all([
    readContract(publicClient, {
      address: srcTokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    readContract(publicClient, {
      address: destTokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);

  const priceRoute = await paraswapSdk.swap.getRate({
    userAddress: accountAddress,

    srcToken: srcTokenAddress,
    srcDecimals: srcTokenDecimals,

    destToken: destTokenAddress,
    destDecimals: destTokenDecimals,

    side: SwapSide.BUY,
    amount: exactDestTokenAmount.toString(),

    options: {
      includeContractMethods: SUPPORTED_CONTRACT_METHODS as unknown as ContractMethod[],
      excludeRFQ: true,
      ignoreBadUsdPrice: true,
      partner: PARASWAP_PARTNER_NAME,
      maxImpact: PARASWAP_MAX_PRICE_IMPACT_PCT,
      excludeDEXS: PARASWAP_EXCLUDE_DEXS,
    },
  });

  return { ...priceRoute };
}

export async function getParaswapExactBuyTxPayload({
  publicClient,
  accountAddress,
  srcTokenAddress,
  destTokenAddress,
  exactDestTokenAmount,
  quote,
  ...slippageParams
}: ParaswapExactBuyParameters & { quote?: OptimalRate }): Promise<ParaswapExactBuyTxPayload> {
  if (
    slippageParams.slippageType == "slippage" &&
    (slippageParams.maxSlippage <= 0 || slippageParams.maxSlippage > MAX_SLIPPAGE_TOLERANCE_LIMIT)
  ) {
    throw Error(
      `Invalid slippage tolerance: ${slippageParams.maxSlippage}. Must be between 0 and ${MAX_SLIPPAGE_TOLERANCE_LIMIT}`
    );
  }

  if (!quote) {
    quote = await getParaswapExactBuyQuote({
      publicClient,
      accountAddress,
      srcTokenAddress,
      destTokenAddress,
      exactDestTokenAmount,
    });
  }

  const maxSrcTokenAmount =
    slippageParams.slippageType == "max-input"
      ? slippageParams.maxSrcTokenAmount
      : computeAmountWithSlippageSurplus(BigInt(quote.srcAmount), slippageParams.maxSlippage);

  const txParams = await paraswapSdk.swap.buildTx(
    {
      userAddress: accountAddress,

      srcToken: srcTokenAddress,
      srcDecimals: quote.srcDecimals,

      destToken: destTokenAddress,
      destDecimals: quote.destDecimals,

      srcAmount: maxSrcTokenAmount.toString(),
      destAmount: exactDestTokenAmount.toString(),

      priceRoute: quote,

      partner: PARASWAP_PARTNER_NAME,
      partnerAddress: PARASWAP_PARTNER_ADDRESS,
      takeSurplus: true,
      isSurplusToUser: true,
    },
    {
      ignoreChecks: true,
    }
  );

  if(!isAddressEqual(getAddress(txParams.to), PARASWAP_SUPPORTED_AGUSTUS_ADDRESS)) {
    // Require agustus matching the supported one to ensure abi offset compatibility
    throw new Error(`Unsupported augustus address: ${txParams.to}`);
  }

  return {
    augustus: getAddress(txParams.to),
    calldata: txParams.data as Hex,
    offsets: OFFSET_LOOKUP_TABLE[quote.contractMethod as SupportedContractMethod],
    quoteSrcTokenAmount: BigInt(quote.srcAmount),
    maxSrcTokenAmount,
    inputs: {
      srcTokenAddress,
      destTokenAddress,
      exactDestTokenAmount,
    },
  };
}
