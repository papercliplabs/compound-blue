import { Chain, polygon } from "viem/chains";
import { AnvilTestClient } from "@morpho-org/test";
import { createPublicClient, http } from "viem";
import { createViemTest } from "@morpho-org/test/vitest";
import "./helpers/expect";
import "dotenv/config";

export interface ViemTestContext<chain extends Chain = Chain> {
  client: AnvilTestClient<chain>;
}

export const test = createViemTest(polygon, {
  forkUrl: process.env.NEXT_PUBLIC_RPC_URL_1!,
  forkBlockNumber: 71054290,
  // hardfork: "Latest",
});

const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(),
});
const currentBlock = await polygonClient.getBlock();

export const currentBlockTest = createViemTest(polygon, {
  forkUrl: process.env.NEXT_PUBLIC_RPC_URL_1!,
  forkBlockNumber: currentBlock.number,
  hardfork: "Latest",
});
