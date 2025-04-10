import { createBundle, paraswapBuy } from "@/actions/bundler3";
import { test } from "../../setup";
import { BundlerCall } from "@morpho-org/bundler-sdk-viem";
import { getParaswapQuote } from "@/data/paraswap/getParaswapExactBuy";
import { describe } from "vitest";

describe("paraswap", () => {
  test("getParaswapQuote", async ({ client }) => {
    const srcTokenAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const destTokenAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
    const buyAmount = BigInt(100000);
    const quote = await getParaswapQuote({
      publicClient: client,
      accountAddress: client.account.address,
      srcTokenAddress,
      destTokenAddress,
      side: "buy",
      amount: buyAmount,
      maxSlippageThreshold: 0.01,
    });

    const bundlerCalls: BundlerCall[] = [
      paraswapBuy(
        quote.augustus,
        quote.calldata,
        srcTokenAddress,
        destTokenAddress,
        quote.offsets,
        client.account.address
      ),
    ].flat();

    const bundle = createBundle(bundlerCalls);

    client.deal({
      erc20: srcTokenAddress,
      amount: BigInt(100000000000),
    });

    console.log("QUOTE", quote);
  });
});
