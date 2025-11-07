import { AnvilTestClient } from "@morpho-org/test";
import { createViemTest } from "@morpho-org/test/vitest";
import { Address, createPublicClient, http, parseUnits } from "viem";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { polygon } from "viem/chains";
import { describe, expect } from "vitest";

import "dotenv/config";
import { getParaswapExactBuyTxPayload } from "@/actions/data/paraswap/getParaswapExactBuy";
import { createBundle, paraswapBuy } from "@/actions/utils/bundlerActions";
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
});

interface ParaswapAdapterExactBuyTest {
  client: AnvilTestClient;

  srcTokenAddress: Address;
  destTokenAddress: Address;

  maxSrcTokenAmount: bigint;
  exactDestTokenAmount: bigint;

  initialSrcTokenBalance?: bigint;
}

async function runParaswapTest({
  client,

  srcTokenAddress,
  destTokenAddress,

  maxSrcTokenAmount,
  exactDestTokenAmount,

  initialSrcTokenBalance = maxSrcTokenAmount,
}: ParaswapAdapterExactBuyTest) {
  // Arrange
  // Give the adapter the necessary src tokens
  await client.deal({ erc20: srcTokenAddress, amount: initialSrcTokenBalance, account: PARASWAP_ADAPTER_ADDRESS! });

  // Act
  const paraswapExactBuyParams = await getParaswapExactBuyTxPayload({
    publicClient: client,
    accountAddress: PARASWAP_ADAPTER_ADDRESS!,

    srcTokenAddress,
    destTokenAddress,

    slippageType: "max-input",
    maxSrcTokenAmount,

    exactDestTokenAmount,
  });

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

const testCases: ({ name: string } & Omit<ParaswapAdapterExactBuyTest, "client">)[] = [
  {
    name: "basic",
    srcTokenAddress: USDT_ADDRESS,
    destTokenAddress: USDC_ADDRESS,
    maxSrcTokenAmount: parseUnits("105", 6),
    exactDestTokenAmount: parseUnits("100", 6),
  },
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
