import { polygon } from "viem/chains";
import { createPublicClient, http } from "viem";
import { createViemTest } from "@morpho-org/test/vitest";
import { AnvilArgs, createAnvilTestClient, spawnAnvil } from "@morpho-org/test";

export const test = createViemTest(polygon, {
  forkUrl: process.env.NEXT_PUBLIC_RPC_URL_1!,
  forkBlockNumber: 71095170,
  // forkBlockNumber: 71054290,
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

// Used for tests that need a specific block number besides default from test (ex when have quotes)
export async function createAnvilForkAtBlock(forkBlockNumber: bigint) {
  const parameters: AnvilArgs = {
    forkChainId: polygon.id,
    forkUrl: process.env.NEXT_PUBLIC_RPC_URL_1!,
    autoImpersonate: true,
    order: "fifo",
    stepsTracing: true,
    pruneHistory: true,
    gasPrice: 0n,
    blockBaseFeePerGas: 0n,
    forkBlockNumber,
  };
  const { rpcUrl, stop } = await spawnAnvil(parameters);

  const client = createAnvilTestClient(
    http(rpcUrl, {
      fetchOptions: {
        cache: "force-cache",
      },
      timeout: 30_000,
    }),
    polygon
  );

  // Make block timestamp 100% predictable.
  await client.setBlockTimestampInterval({ interval: 1 });

  return { client, stop };
}
