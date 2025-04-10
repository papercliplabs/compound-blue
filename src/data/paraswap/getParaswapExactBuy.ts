import { CHAIN_ID, PARASWAP_PARTNER_ADDRESS, PARASWAP_PARTNER_NAME } from "@/config";
import { TransactionParams, OptimalRate, SwapSide } from "@paraswap/sdk";
import { Address, Client, erc20Abi, getAddress, Hex } from "viem";
import { readContract } from "viem/actions";
import { safeFetch } from "@/utils/fetch";
import {
  GetParaswapReturnType,
  OFFSET_LOOKUP_TABLE,
  SUPPORTED_CONTRACT_METHODS,
  SupportedContractMethod,
} from "./common";

interface GetParaswapExactBuyParameters {
  publicClient: Client;
  accountAddress: Address;

  srcTokenAddress: Address;
  destTokenAddress: Address;

  exactDestTokenAmount: bigint;
  maxSrcTokenAmount: bigint; // This is how slippage is enforced
}

export async function getParaswapExactBuy({
  publicClient,
  accountAddress,
  srcTokenAddress,
  destTokenAddress,
  exactDestTokenAmount,
  maxSrcTokenAmount,
}: GetParaswapExactBuyParameters): Promise<GetParaswapReturnType> {
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

  // Price
  const priceParams = new URLSearchParams({
    network: CHAIN_ID.toString(),
    userAddress: accountAddress,

    srcToken: srcTokenAddress,
    srcDecimals: srcTokenDecimals.toString(),

    destToken: destTokenAddress,
    destDecimals: destTokenDecimals.toString(),

    side: SwapSide.BUY,
    amount: exactDestTokenAmount.toString(), // Exact buy amount since BUY side

    includeContractMethods: SUPPORTED_CONTRACT_METHODS.join(","),

    excludeDEXS: "ParaSwapPool,ParaSwapLimitOrders",

    version: "6.2",
    partner: PARASWAP_PARTNER_NAME,
  });
  const priceData = await safeFetch<{ priceRoute: OptimalRate }>(
    `https://api.paraswap.io/prices?${priceParams.toString()}`
  );
  if (!priceData) {
    throw new Error("Failed to get paraswap quote");
  }
  const priceRoute = priceData.priceRoute;

  // Transaction
  const transactionData = await safeFetch<TransactionParams>(
    `https://api.paraswap.io/transactions/${CHAIN_ID}?ignoreChecks=true&ignoreGasEstimate=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        srcToken: srcTokenAddress,
        srcDecimals: srcTokenDecimals.toString(),

        destToken: destTokenAddress,
        destDecimals: destTokenDecimals.toString(),

        srcAmount: maxSrcTokenAmount.toString(),
        destAmount: exactDestTokenAmount.toString(),

        priceRoute,

        userAddress: accountAddress,

        // Give our portion of surplus back to the users
        takeSurplus: true,
        isSurplusToUser: true,
        partner: PARASWAP_PARTNER_NAME,
        partnerAddress: PARASWAP_PARTNER_ADDRESS,
      }),
    }
  );

  if (!transactionData) {
    throw new Error("Failed to get paraswap quote");
  }

  return {
    augustus: getAddress(transactionData.to),
    calldata: transactionData.data as Hex,
    offsets: OFFSET_LOOKUP_TABLE[priceData.priceRoute.contractMethod as SupportedContractMethod],
  };
}
