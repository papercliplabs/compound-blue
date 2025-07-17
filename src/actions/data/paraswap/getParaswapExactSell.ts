import { MathLib } from "@morpho-org/blue-sdk";
import { ContractMethod, OptimalRate, SwapSide } from "@paraswap/sdk";
import { Address, Client, Hex, erc20Abi, getAddress, isAddressEqual } from "viem";
import { readContract } from "viem/actions";

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

export type ParaswapExactSellParameters = {
  publicClient: Client;
  accountAddress: Address;

  srcTokenAddress: Address;
  destTokenAddress: Address;

  exactSrcTokenAmount: bigint;
} & (
  | {
      slippageType: "max-input";
      minDestTokenAmount: bigint;
    }
  | {
      slippageType: "slippage";
      maxSlippage: number; // (0, MAX_SLIPPAGE_TOLERANCE_LIMIT]
    }
);

export interface ParaswapExactSellTxPayload extends ParaswapBaseTxPayload {
  quoteDestTokenAmount: bigint;
  minDestTokenAmount: bigint;
  inputs: {
    srcTokenAddress: Address;
    destTokenAddress: Address;
    exactSrcTokenAmount: bigint;
  };
}

export async function getParaswapExactSellQuote({
  publicClient,
  accountAddress,
  srcTokenAddress,
  destTokenAddress,
  exactSrcTokenAmount,
}: Omit<ParaswapExactSellParameters, "slippageType" | "maxSlippage" | "minDestTokenAmount">): Promise<OptimalRate> {
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

    side: SwapSide.SELL,
    amount: exactSrcTokenAmount.toString(),

    options: {
      includeContractMethods: SUPPORTED_CONTRACT_METHODS as unknown as ContractMethod[],
      excludeRFQ: true,
      ignoreBadUsdPrice: true,
      partner: PARASWAP_PARTNER_NAME,
      maxImpact: PARASWAP_MAX_PRICE_IMPACT_PCT,
      excludeDEXS: PARASWAP_EXCLUDE_DEXS,
    },
  });

  return priceRoute;
}

export async function getParaswapExactSellTxPayload({
  publicClient,
  accountAddress,
  srcTokenAddress,
  destTokenAddress,
  exactSrcTokenAmount,
  quote,
  ...slippageParams
}: ParaswapExactSellParameters & { quote?: OptimalRate }): Promise<ParaswapExactSellTxPayload> {
  if (
    slippageParams.slippageType == "slippage" &&
    (slippageParams.maxSlippage <= 0 || slippageParams.maxSlippage > MAX_SLIPPAGE_TOLERANCE_LIMIT)
  ) {
    throw Error(
      `Invalid slippage tolerance: ${slippageParams.maxSlippage}. Must be between 0 and ${MAX_SLIPPAGE_TOLERANCE_LIMIT}`
    );
  }

  if (!quote) {
    quote = await getParaswapExactSellQuote({
      publicClient,
      accountAddress,
      srcTokenAddress,
      destTokenAddress,
      exactSrcTokenAmount,
    });
  }

  const minDestTokenAmount =
    slippageParams.slippageType == "max-input"
      ? slippageParams.minDestTokenAmount
      : MathLib.mulDivUp(
          BigInt(quote.destAmount),
          MathLib.WAD,
          BigInt(Math.floor((1 + slippageParams.maxSlippage) * Number(MathLib.WAD)))
        );

  const txParams = await paraswapSdk.swap.buildTx(
    {
      userAddress: accountAddress,

      srcToken: srcTokenAddress,
      srcDecimals: quote.srcDecimals,

      destToken: destTokenAddress,
      destDecimals: quote.destDecimals,

      srcAmount: exactSrcTokenAmount.toString(),
      destAmount: minDestTokenAmount.toString(),

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
    quoteDestTokenAmount: BigInt(quote.destAmount),
    minDestTokenAmount,
    inputs: {
      srcTokenAddress,
      destTokenAddress,
      exactSrcTokenAmount,
    },
  };
}
