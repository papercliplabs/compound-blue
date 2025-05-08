import fs from "fs";
import path from "path";

import { AnvilTestClient } from "@morpho-org/test";
import { OptimalRate } from "@paraswap/sdk";
import { Address } from "viem";
import { expect, vi, test as vitestTest } from "vitest";

import * as paraswapExactBuy from "@/actions/data/paraswap/getParaswapExactBuy";
import * as paraswapExactSell from "@/actions/data/paraswap/getParaswapExactSell";

import { createAnvilForkAtBlock } from "../../config";
import { currentBlock } from "../../config";
import { deserializeBigInts } from "../../helpers/bigInt";
import { serializeBigInts } from "../../helpers/bigInt";
import { hashArgs } from "../../helpers/hash";

interface Snapshot {
  blockNumber: bigint;
  paraswapExactBuyQuotes: Record<string, OptimalRate>;
  paraswapExactBuyTxPayloads: Record<string, paraswapExactBuy.ParaswapExactBuyTxPayload>;
  paraswapExactSellQuotes: Record<string, OptimalRate>;
  paraswapExactSellTxPayloads: Record<string, paraswapExactSell.ParaswapExactSellTxPayload>;
}

// Uses saved snapshot data if available, otherwise runs at the chain tip and saves the snapshot for future runs
export const paraswapSnapshotTest = vitestTest.extend<{ client: AnvilTestClient }>({
  client: async ({}, use) => {
    const testName = expect.getState().currentTestName!;
    const snapshotPath = path.resolve(__dirname, `./__snapshots__/${testName}.json`);

    function getKey({ srcTokenAddress, destTokenAddress }: { srcTokenAddress: Address; destTokenAddress: Address }) {
      return hashArgs({ srcTokenAddress, destTokenAddress });
    }

    let snapshot: Snapshot;
    const snapshotExists = fs.existsSync(snapshotPath);
    if (snapshotExists) {
      snapshot = deserializeBigInts(JSON.parse(fs.readFileSync(snapshotPath, "utf-8")));

      vi.spyOn(paraswapExactBuy, "getParaswapExactBuyQuote").mockImplementation(async (args) => {
        const result = snapshot.paraswapExactBuyQuotes[getKey(args)];
        return result;
      });

      vi.spyOn(paraswapExactBuy, "getParaswapExactBuyTxPayload").mockImplementation(async (args) => {
        const result = snapshot.paraswapExactBuyTxPayloads[getKey(args)];
        return result;
      });

      vi.spyOn(paraswapExactSell, "getParaswapExactSellQuote").mockImplementation(async (args) => {
        const result = snapshot.paraswapExactSellQuotes[getKey(args)];
        return result;
      });

      vi.spyOn(paraswapExactSell, "getParaswapExactSellTxPayload").mockImplementation(async (args) => {
        const result = snapshot.paraswapExactSellTxPayloads[getKey(args)];
        return result;
      });
    } else {
      snapshot = {
        blockNumber: currentBlock.number,
        paraswapExactBuyQuotes: {},
        paraswapExactBuyTxPayloads: {},
        paraswapExactSellQuotes: {},
        paraswapExactSellTxPayloads: {},
      };

      // No fixture, so run at current block, tracking the quotes to make a fixture
      const originalGetParaswapExactBuyQuote = paraswapExactBuy.getParaswapExactBuyQuote;
      vi.spyOn(paraswapExactBuy, "getParaswapExactBuyQuote").mockImplementation(async (args) => {
        const result = await originalGetParaswapExactBuyQuote(args);
        snapshot.paraswapExactBuyQuotes[getKey(args)] = result;
        return result;
      });

      const originalGetParaswapExactBuyTxPayload = paraswapExactBuy.getParaswapExactBuyTxPayload;
      vi.spyOn(paraswapExactBuy, "getParaswapExactBuyTxPayload").mockImplementation(async (args) => {
        const result = await originalGetParaswapExactBuyTxPayload(args);
        snapshot.paraswapExactBuyTxPayloads[getKey(args)] = result;
        return result;
      });

      const originalGetParaswapExactSellQuote = paraswapExactSell.getParaswapExactSellQuote;
      vi.spyOn(paraswapExactSell, "getParaswapExactSellQuote").mockImplementation(async (args) => {
        const result = await originalGetParaswapExactSellQuote(args);
        snapshot.paraswapExactSellQuotes[getKey(args)] = result;
        return result;
      });

      const originalGetParaswapExactSellTxPayload = paraswapExactSell.getParaswapExactSellTxPayload;
      vi.spyOn(paraswapExactSell, "getParaswapExactSellTxPayload").mockImplementation(async (args) => {
        const result = await originalGetParaswapExactSellTxPayload(args);
        snapshot.paraswapExactSellTxPayloads[getKey(args)] = result;
        return result;
      });
    }

    const { client, stop } = await createAnvilForkAtBlock(snapshot.blockNumber);

    // Run the test with the client
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(client);

    if (!snapshotExists) {
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.writeFileSync(snapshotPath, JSON.stringify(serializeBigInts(snapshot), null, 2));
    }

    vi.clearAllMocks();
    await stop();
  },
});
