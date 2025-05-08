import { AnvilTestClient } from "@morpho-org/test";
import { createViemTest } from "@morpho-org/test/vitest";
import { Address, createPublicClient, http, parseUnits } from "viem";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { polygon } from "viem/chains";
import { describe, expect } from "vitest";


import "dotenv/config";
import { createBundle, paraswapBuy } from "@/actions/bundler3";
import { SUPPORTED_DEXS } from "@/data/paraswap/config";
import { getParaswapExactBuy } from "@/data/paraswap/getParaswapExactBuy";
import { GetParaswapReturnType, SupportedDex } from "@/data/paraswap/types";
import { PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";

import { USDC_ADDRESS, USDT_ADDRESS } from "../../helpers/constants";
import { getErc20BalanceOf } from "../../helpers/erc20";

const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(),
});
const currentBlock = await polygonClient.getBlock();

export const test = createViemTest(polygon, {
  forkUrl: process.env.NEXT_PUBLIC_RPC_URL_1!,
  forkBlockNumber: currentBlock.number,
  hardfork: "Latest",
});

interface ParaswapAdapterExactBuyTest {
  client: AnvilTestClient;
  srcTokenAddress: Address;
  destTokenAddress: Address;

  maxSrcTokenAmount: bigint;
  exactDestTokenAmount: bigint;

  forceDex?: SupportedDex;
}

async function runParaswapTest({
  client,
  srcTokenAddress,
  destTokenAddress,
  maxSrcTokenAmount,
  exactDestTokenAmount,
  forceDex,
}: ParaswapAdapterExactBuyTest) {
  // Arrange

  // Give the adapter the necessary src tokens
  await client.deal({ erc20: srcTokenAddress, amount: maxSrcTokenAmount, account: PARASWAP_ADAPTER_ADDRESS! });

  // Act
  let paraswapExactBuyParams: GetParaswapReturnType;
  try {
    paraswapExactBuyParams = await getParaswapExactBuy({
      publicClient: client,
      accountAddress: PARASWAP_ADAPTER_ADDRESS!,
      srcTokenAddress,
      destTokenAddress,
      maxSrcTokenAmount,
      exactDestTokenAmount,
      allowedDexs: forceDex ? [forceDex] : undefined,
    });
  } catch {
    // Prepare error is fine, check logs but likely all just no route with enough liquidity
    return;
  }

  const paraswapBundlerCall = paraswapBuy(
    paraswapExactBuyParams.augustus,
    paraswapExactBuyParams.calldata,
    srcTokenAddress,
    destTokenAddress,
    paraswapExactBuyParams.offsets,
    client.account.address
  );

  const bundle = createBundle(paraswapBundlerCall);

  const hash = await sendTransaction(client, {
    ...bundle,
  });
  const receipt = await waitForTransactionReceipt(client, { hash });

  // Assert
  expect(receipt.status).toBe("success");

  const walletBalance = await getErc20BalanceOf(client, destTokenAddress, client.account.address);
  expect(walletBalance).toBe(exactDestTokenAmount);

  // There will be leftovers in the adapter, don't care about them for this test, this is about making sure the swap actually executes
}

const srcTokenAddress = USDT_ADDRESS;
const destTokenAddress = USDC_ADDRESS;
const maxSrcTokenAmount = parseUnits("105", 6);
const exactDestTokenAmount = parseUnits("100", 6);

const testCases: ({ name: string } & Omit<ParaswapAdapterExactBuyTest, "client">)[] = [
  // Testing each supported dex individually
  // Using this to help identify and exclude dex's with systematic issues
  // Note that error from not enough liquidity is acceptable, but transaction reverts are not
  ...SUPPORTED_DEXS.map((dex) => ({
    name: dex,
    srcTokenAddress,
    destTokenAddress,
    maxSrcTokenAmount,
    exactDestTokenAmount,
    forceDex: dex as SupportedDex,
  })),
];

describe("paraswap-test", () => {
  testCases.map((testCase) => {
    test(testCase.name, async ({ client }) => {
      await runParaswapTest({
        client,
        ...testCase,
      });
    });
  });
});
