import { test as vitestTest } from "vitest";
import { Chain, polygon } from "viem/chains";
import { AnvilArgs, AnvilTestClient, spawnAnvil } from "@morpho-org/test";
import { http } from "viem";
import { createAnvilTestClient } from "@morpho-org/test";
import "./helpers/expect";
import "dotenv/config";

export interface ViemTestContext<chain extends Chain = Chain> {
  client: AnvilTestClient<chain>;
}

// Same as https://github.com/morpho-org/sdks/blob/main/packages/test/src/vitest/index.ts
// Can't use directly due to package bundling error with commonJS
export const createViemTest = <chain extends Chain>(chain: chain, parameters: AnvilArgs = {}) => {
  parameters.forkChainId ??= chain?.id;
  parameters.forkUrl ??= chain?.rpcUrls.default.http[0];
  parameters.autoImpersonate ??= true;
  parameters.order ??= "fifo";
  parameters.stepsTracing ??= true;
  parameters.pruneHistory = true;

  parameters.gasPrice ??= BigInt(0);
  parameters.blockBaseFeePerGas ??= BigInt(0);

  return vitestTest.extend<ViemTestContext<chain>>({
    // biome-ignore lint/correctness/noEmptyPattern: required by vitest at runtime
    client: async ({}, use) => {
      const { rpcUrl, stop } = await spawnAnvil(parameters);

      const client = createAnvilTestClient(
        http(rpcUrl, {
          fetchOptions: {
            cache: "force-cache",
          },
          timeout: 30_000,
          batch: true,
        }),
        chain
      );

      await client.setBlockTimestampInterval({ interval: 2 });

      // Uncomment for debugging
      // client.transport.tracer.all = true; // If you want to trace all submitted transactions, failing or not.

      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(client);

      await stop();
    },
  });
};

export const test = createViemTest(polygon, {
  forkUrl: process.env.NEXT_PUBLIC_RPC_URL_1!,
  forkBlockNumber: 70144589,
  hardfork: "Latest",
});
