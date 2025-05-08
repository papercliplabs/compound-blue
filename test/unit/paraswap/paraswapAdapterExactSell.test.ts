import { AnvilTestClient } from "@morpho-org/test";
import { createViemTest } from "@morpho-org/test/vitest";
import { Address, createPublicClient, http, parseEther, parseUnits } from "viem";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { polygon } from "viem/chains";
import { describe, expect } from "vitest";

import { getParaswapExactSellTxPayload } from "@/actions/data/paraswap/getParaswapExactSell";
import { createBundle, paraswapSell } from "@/actions/utils/bundlerActions";
import { PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";

import { USDC_ADDRESS, USDT_ADDRESS, WETH_ADDRESS } from "../../helpers/constants";
import { getErc20BalanceOf } from "../../helpers/erc20";

import "dotenv/config";

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

interface ParaswapAdapterExactSellTest {
  client: AnvilTestClient;

  srcTokenAddress: Address;
  destTokenAddress: Address;

  exactSrcTokenAmount: bigint;
  minDestTokenAmount: bigint;

  initialSrcTokenBalance?: bigint;
}

async function runParaswapExactSellTest({
  client,

  srcTokenAddress,
  destTokenAddress,

  exactSrcTokenAmount,
  minDestTokenAmount,

  initialSrcTokenBalance = exactSrcTokenAmount,
}: ParaswapAdapterExactSellTest) {
  // Arrange
  await client.deal({ erc20: srcTokenAddress, amount: initialSrcTokenBalance, account: PARASWAP_ADAPTER_ADDRESS! });

  // AgetParaswapExactSellTxPayload
  const paraswapExactSellParams = await getParaswapExactSellTxPayload({
    publicClient: client,
    accountAddress: PARASWAP_ADAPTER_ADDRESS!,

    srcTokenAddress,
    destTokenAddress,

    exactSrcTokenAmount,

    slippageType: "slippage",
    maxSlippage: 0.05,
  });

  const paraswapBundlerCall = paraswapSell(
    paraswapExactSellParams.augustus,
    paraswapExactSellParams.calldata,
    srcTokenAddress,
    destTokenAddress,
    false,
    paraswapExactSellParams.offsets,
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
  expect(walletBalance).toBeGreaterThan(minDestTokenAmount);

  // There will be leftovers in the adapter, don't care about them for this test, this is about making sure the swap actually executes
}

const testCases: ({ name: string } & Omit<ParaswapAdapterExactSellTest, "client">)[] = [
  {
    name: "basic",
    srcTokenAddress: USDT_ADDRESS,
    destTokenAddress: USDC_ADDRESS,
    exactSrcTokenAmount: parseUnits("105", 6),
    minDestTokenAmount: parseUnits("100", 6),
  },
  {
    name: "weth to usdc",
    srcTokenAddress: WETH_ADDRESS,
    destTokenAddress: USDC_ADDRESS,
    exactSrcTokenAmount: parseEther("0.001"),
    minDestTokenAmount: parseUnits("1", 6),
  },
];

describe("paraswap-sell-test", () => {
  testCases.map((testCase) => {
    test(testCase.name, async ({ client }) => {
      await runParaswapExactSellTest({
        client,
        ...testCase,
      });
    });
  });
});
