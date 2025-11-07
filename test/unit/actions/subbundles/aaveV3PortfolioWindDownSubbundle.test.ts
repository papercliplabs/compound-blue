import { AnvilTestClient } from "@morpho-org/test";
import { Address, isAddressEqual, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { describe, expect } from "vitest";

import { aaveV3UiPoolDataProviderAbi } from "@/abis/aaveV3UiPoolDataProviderAbi";
import {
  PARASWAP_MIN_SWAP_AMOUNT,
  aaveV3PortfolioWindDownSubbundle,
} from "@/actions/subbundles/aaveV3PortfolioWindDownSubbundle";
import { createBundle } from "@/actions/utils/bundlerActions";
import { computeScaledAmount } from "@/actions/utils/math";
import { Action } from "@/actions/utils/types";
import { AAVE_V3_POOL_ADDRESS_PROVIDER, AAVE_V3_UI_POOL_DATA_PROVIDER_ADDRESS } from "@/config";
import {
  AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
  BUNDLER3_ADDRESS,
  GENERAL_ADAPTER_1_ADDRESS,
  PARASWAP_ADAPTER_ADDRESS,
} from "@/utils/constants";

import { test } from "../../../config";
import {
  borrowFromAaveV3,
  dealAndSupplyToAaveV3,
  getAaveV3LoanBalance,
  getAaveV3SupplyBalance,
} from "../../../helpers/aaveV3";
import { DAI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS } from "../../../helpers/constants";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
import { paraswapSnapshotTest } from "../../snapshots/paraswapSnapshotTest";

interface RunAaveV3PortfolioWindDownSubbundleTestParameters {
  client: AnvilTestClient;

  portfolioPercentage: number;
  maxSlippageTolerance: number;
  flashLoanAssetAddress: Address;
  outputAssetAddress: Address;

  // Must be correctly collateralized
  initialPositions: { assetAddress: Address; supplyAmount: bigint; borrowAmount: bigint }[];

  minOutputAssets: bigint; // In GA1 at the end of the subbundle
}

async function runAaveV3PortfolioWindDownSubbundleTest({
  client,

  portfolioPercentage,
  maxSlippageTolerance,
  flashLoanAssetAddress,
  outputAssetAddress,

  initialPositions,
  minOutputAssets,
}: RunAaveV3PortfolioWindDownSubbundleTestParameters) {
  // Arrange
  const collateralPositions = initialPositions.filter((p) => p.supplyAmount > 0n);
  const borrowPositions = initialPositions.filter((p) => p.borrowAmount > 0n);

  for (const p of collateralPositions) {
    await dealAndSupplyToAaveV3(client, p.assetAddress, p.supplyAmount, true);
  }
  for (const p of borrowPositions) {
    await borrowFromAaveV3(client, p.assetAddress, p.borrowAmount);
  }

  // Act
  const subbundle = await aaveV3PortfolioWindDownSubbundle({
    publicClient: client,
    accountAddress: client.account.address,

    portfolioPercentage,
    maxSlippageTolerance,

    flashLoanAssetAddress,
    outputAssetAddress,
  });
  const bundle = createBundle(subbundle.bundlerCalls());
  const action: Action = {
    status: "success",
    signatureRequests: subbundle.signatureRequirements,
    transactionRequests: [...subbundle.transactionRequirements, { name: "Bundle", tx: () => bundle }],
  };
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected

  const [aggregatedReserves] = await readContract(client, {
    address: AAVE_V3_UI_POOL_DATA_PROVIDER_ADDRESS,
    abi: aaveV3UiPoolDataProviderAbi,
    functionName: "getReservesData",
    args: [AAVE_V3_POOL_ADDRESS_PROVIDER],
  });

  // Make sure no dust left anywhere
  for (const p of initialPositions) {
    await expectZeroErc20Balances(
      client,
      [
        BUNDLER3_ADDRESS,
        PARASWAP_ADAPTER_ADDRESS,
        AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
        // Remaining flash loan assets are expected to be in GA1
        ...(isAddressEqual(p.assetAddress, outputAssetAddress) ? [] : [GENERAL_ADAPTER_1_ADDRESS]),
      ],
      p.assetAddress
    );

    const reserve = aggregatedReserves.find((r) => isAddressEqual(r.underlyingAsset, p.assetAddress));
    await expectZeroErc20Balances(
      client,
      [
        BUNDLER3_ADDRESS,
        PARASWAP_ADAPTER_ADDRESS,
        AAVE_V3_MIGRATION_ADAPTER_ADDRESS,
        // Remaining flash loan assets are expected to be in GA1
        ...(isAddressEqual(p.assetAddress, outputAssetAddress) ? [] : [GENERAL_ADAPTER_1_ADDRESS]),
      ],
      reserve!.aTokenAddress
    );

    // Check remaining AAVE balances
    const aaveSupplyBalance = await getAaveV3SupplyBalance(client, p.assetAddress);
    const aaveLoanBalance = await getAaveV3LoanBalance(client, p.assetAddress);

    if (portfolioPercentage == 1) {
      if (p.supplyAmount < PARASWAP_MIN_SWAP_AMOUNT) {
        // Won't pull out the dust
        expect(aaveSupplyBalance).toEqual(p.supplyAmount);
      } else {
        expect(aaveSupplyBalance).toEqual(0n);
      }
      expect(aaveLoanBalance).toEqual(0n);
    } else {
      expect(aaveSupplyBalance).toBeGreaterThanOrEqual(
        computeScaledAmount(p.supplyAmount, 1 - portfolioPercentage, "Down")
      );
      expect(aaveLoanBalance).toBeGreaterThanOrEqual(
        computeScaledAmount(p.borrowAmount, 1 - portfolioPercentage, "Down")
      );
    }
  }

  const ga1OutputAssetBalance = await getErc20BalanceOf(client, outputAssetAddress, GENERAL_ADAPTER_1_ADDRESS);
  expect(ga1OutputAssetBalance).toBeGreaterThanOrEqual(minOutputAssets - 1n); // -1n to account for rounding in favor of markets
}

describe("aaveV3PortfolioWindDownSubbundle", () => {
  describe("happy path", () => {
    describe("supply only", () => {
      paraswapSnapshotTest("partial wind down - supply in FLA only, output = FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
          ],

          minOutputAssets: parseUnits("500", 6),
        });
      });
      paraswapSnapshotTest("partial wind down - supply in FLA only, output != FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDT_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
          ],

          minOutputAssets: parseUnits("497", 6),
        });
      });
      // paraswapSnapshotTest("full wind down - supply in FLA only, output = FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: USDC_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //     ],

      //     minOutputAssets: parseUnits("1000", 6),
      //   });
      // });
      // paraswapSnapshotTest("full wind down - supply in FLA only, output != FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: USDT_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //     ],

      //     minOutputAssets: parseUnits("998", 6),
      //   });
      // });

      paraswapSnapshotTest("partial wind down - output = FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
          ],

          minOutputAssets: parseUnits("992", 6),
        });
      });
      paraswapSnapshotTest("partial wind down - output != FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: DAI_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
          ],

          minOutputAssets: parseUnits("992", 18),
        });
      });
      // paraswapSnapshotTest("full wind down - output = FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: USDC_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDT_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //     ],

      //     minOutputAssets: parseUnits("1986", 6),
      //   });
      // });
      // paraswapSnapshotTest("full wind down - output != FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: DAI_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDT_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //     ],

      //     minOutputAssets: parseUnits("1986", 18),
      //   });
      // });

      paraswapSnapshotTest("partial wind down - with dust (should ignore it)", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: DAI_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: 1n,
              borrowAmount: 0n,
            },
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
          ],

          minOutputAssets: parseUnits("495", 18),
        });
      });

      //   paraswapSnapshotTest("full wind down - with dust (should swap extra for it)", async ({ client }) => {
      //     await runAaveV3PortfolioWindDownSubbundleTest({
      //       client,

      //       portfolioPercentage: 1,
      //       maxSlippageTolerance: 0.015,
      //       flashLoanAssetAddress: USDC_ADDRESS,
      //       outputAssetAddress: DAI_ADDRESS,

      //       initialPositions: [
      //         {
      //           assetAddress: USDT_ADDRESS,
      //           supplyAmount: 1n,
      //           borrowAmount: 0n,
      //         },
      //         {
      //           assetAddress: USDC_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: 0n,
      //         },
      //       ],

      //       minOutputAssets: parseUnits("990", 18),
      //     });
      //   });
    });

    describe("supply and borrow", () => {
      paraswapSnapshotTest("partial wind down - borrow in FLA only, output = FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: 0n,
              borrowAmount: parseUnits("500", 6),
            },
          ],

          minOutputAssets: parseUnits("245", 6),
        });
      });
      paraswapSnapshotTest("partial wind down - borrow in FLA only, output != FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: DAI_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: 0n,
            },
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: 0n,
              borrowAmount: parseUnits("500", 6),
            },
          ],

          minOutputAssets: parseUnits("245", 18),
        });
      });
      // paraswapSnapshotTest("full wind down - borrow in FLA only, output = FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: USDC_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDT_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: 0n,
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //     ],

      //     minOutputAssets: parseUnits("490", 6),
      //   });
      // });
      // paraswapSnapshotTest("full wind down - borrow in FLA only, output != FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: DAI_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDT_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: 0n,
      //       },
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: 0n,
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //     ],

      //     minOutputAssets: parseUnits("490", 18),
      //   });
      // });

      paraswapSnapshotTest("partial wind down - borrow and supply in FLA only, output = FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: parseUnits("500", 6),
            },
          ],

          minOutputAssets: parseUnits("250", 6),
        });
      });
      paraswapSnapshotTest("partial wind down - borrow and supply in FLA only, output != FLA", async ({ client }) => {
        await runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.015,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: DAI_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDC_ADDRESS,
              supplyAmount: parseUnits("1000", 6),
              borrowAmount: parseUnits("500", 6),
            },
          ],

          minOutputAssets: parseUnits("245", 18),
        });
      });
      // paraswapSnapshotTest("full wind down - borrow and supply in FLA only, output = FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: USDC_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //     ],

      //     minOutputAssets: parseUnits("500", 6),
      //   });
      // });
      // paraswapSnapshotTest("full wind down - borrow and supply in FLA only, output != FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: USDC_ADDRESS,
      //     outputAssetAddress: DAI_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //     ],

      //     minOutputAssets: parseUnits("495", 18),
      //   });
      // });

      //   paraswapSnapshotTest("partial wind down - output = FLA", async ({ client }) => {
      //     await runAaveV3PortfolioWindDownSubbundleTest({
      //       client,

      //       portfolioPercentage: 0.5,
      //       maxSlippageTolerance: 0.015,
      //       flashLoanAssetAddress: USDC_ADDRESS,
      //       outputAssetAddress: USDC_ADDRESS,

      //       initialPositions: [
      //         {
      //           assetAddress: USDT_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: USDC_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: WETH_ADDRESS,
      //           supplyAmount: parseEther("1"),
      //           borrowAmount: 0n,
      //         },
      //         {
      //           assetAddress: DAI_ADDRESS,
      //           supplyAmount: 0n,
      //           borrowAmount: parseUnits("100", 18),
      //         },
      //       ],
      //       minOutputAssets: parseUnits("1590", 6), // Need to update if taking a new snapshot to reflect ETH price
      //     });
      //   });
      //   paraswapSnapshotTest("partial wind down - output != FLA", async ({ client }) => {
      //     await runAaveV3PortfolioWindDownSubbundleTest({
      //       client,

      //       portfolioPercentage: 0.5,
      //       maxSlippageTolerance: 0.015,
      //       flashLoanAssetAddress: USDC_ADDRESS,
      //       outputAssetAddress: DAI_ADDRESS,

      //       initialPositions: [
      //         {
      //           assetAddress: USDT_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: USDC_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: WETH_ADDRESS,
      //           supplyAmount: parseEther("1"),
      //           borrowAmount: 0n,
      //         },
      //         {
      //           assetAddress: DAI_ADDRESS,
      //           supplyAmount: 0n,
      //           borrowAmount: parseUnits("100", 18),
      //         },
      //       ],
      //       minOutputAssets: parseUnits("1590", 18), // Need to update if taking a new snapshot to reflect ETH price
      //     });
      //   });

      //   paraswapSnapshotTest("full wind down, output = FLA", async ({ client }) => {
      //     await runAaveV3PortfolioWindDownSubbundleTest({
      //       client,

      //       portfolioPercentage: 1,
      //       maxSlippageTolerance: 0.015,
      //       flashLoanAssetAddress: USDC_ADDRESS,
      //       outputAssetAddress: USDC_ADDRESS,

      //       initialPositions: [
      //         {
      //           assetAddress: USDT_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: USDC_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: WETH_ADDRESS,
      //           supplyAmount: parseEther("1"),
      //           borrowAmount: 0n,
      //         },
      //         {
      //           assetAddress: DAI_ADDRESS,
      //           supplyAmount: 0n,
      //           borrowAmount: parseUnits("100", 18),
      //         },
      //       ],
      //       minOutputAssets: parseUnits("3180", 6), // Need to update if taking a new snapshot to reflect ETH price
      //     });
      //   });

      //   paraswapSnapshotTest("full wind down - output != FLA", async ({ client }) => {
      //     await runAaveV3PortfolioWindDownSubbundleTest({
      //       client,

      //       portfolioPercentage: 1,
      //       maxSlippageTolerance: 0.015,
      //       flashLoanAssetAddress: USDC_ADDRESS,
      //       outputAssetAddress: DAI_ADDRESS,

      //       initialPositions: [
      //         {
      //           assetAddress: USDT_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: USDC_ADDRESS,
      //           supplyAmount: parseUnits("1000", 6),
      //           borrowAmount: parseUnits("500", 6),
      //         },
      //         {
      //           assetAddress: WETH_ADDRESS,
      //           supplyAmount: parseEther("1"),
      //           borrowAmount: 0n,
      //         },
      //         {
      //           assetAddress: DAI_ADDRESS,
      //           supplyAmount: 0n,
      //           borrowAmount: parseUnits("100", 18),
      //         },
      //       ],
      //       minOutputAssets: parseUnits("3180", 18), // Need to update if taking a new snapshot to reflect ETH price
      //     });
      //   });
      // });

      // paraswapSnapshotTest("full wind down - output != FLA, WBTC FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: WBTC_ADDRESS,
      //     outputAssetAddress: DAI_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDT_ADDRESS,
      //         supplyAmount: parseUnits("10000", 6),
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //       {
      //         assetAddress: WETH_ADDRESS,
      //         supplyAmount: parseEther("1"),
      //         borrowAmount: 0n,
      //       },
      //       {
      //         assetAddress: DAI_ADDRESS,
      //         supplyAmount: 0n,
      //         borrowAmount: parseUnits("100", 18),
      //       },
      //     ],
      //     minOutputAssets: parseUnits("3180", 18), // Need to update if taking a new snapshot to reflect ETH price
      //   });
      // });

      // paraswapSnapshotTest("full wind down - output != FLA, WBTC FLA", async ({ client }) => {
      //   await runAaveV3PortfolioWindDownSubbundleTest({
      //     client,

      //     portfolioPercentage: 1,
      //     maxSlippageTolerance: 0.015,
      //     flashLoanAssetAddress: WBTC_ADDRESS,
      //     outputAssetAddress: DAI_ADDRESS,

      //     initialPositions: [
      //       {
      //         assetAddress: USDT_ADDRESS,
      //         supplyAmount: parseUnits("10000", 6),
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //       {
      //         assetAddress: USDC_ADDRESS,
      //         supplyAmount: parseUnits("1000", 6),
      //         borrowAmount: parseUnits("500", 6),
      //       },
      //       {
      //         assetAddress: WETH_ADDRESS,
      //         supplyAmount: parseEther("1"),
      //         borrowAmount: 0n,
      //       },
      //       {
      //         assetAddress: DAI_ADDRESS,
      //         supplyAmount: 0n,
      //         borrowAmount: parseUnits("100", 18),
      //       },
      //       {
      //         assetAddress: WBTC_ADDRESS,
      //         supplyAmount: parseUnits("0.1", 8),
      //         borrowAmount: parseUnits("0.01", 8),
      //       },
      //     ],
      //     minOutputAssets: parseUnits("21150", 18), // Need to update if taking a new snapshot to reflect ETH price
      //   });
    });
  });

  describe("sad path", () => {
    test("throws when portfolio percentage is 0", async ({ client }) => {
      await expect(
        runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0,
          maxSlippageTolerance: 0.05,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: 1000n,
              borrowAmount: 100n,
            },
          ],
          minOutputAssets: 100n,
        })
      ).rejects.toThrow("Portfolio percentage must be between 0 (exclusive) and 1 (inclusive)");
    });

    test("throws when portfolio percentage is > 1", async ({ client }) => {
      await expect(
        runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 1.01,
          maxSlippageTolerance: 0.05,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: 1000n,
              borrowAmount: 100n,
            },
          ],
          minOutputAssets: 100n,
        })
      ).rejects.toThrow("Portfolio percentage must be between 0 (exclusive) and 1 (inclusive)");
    });

    test("throws when slippage tolerance is 0", async ({ client }) => {
      await expect(
        runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: 1000n,
              borrowAmount: 100n,
            },
          ],
          minOutputAssets: 100n,
        })
      ).rejects.toThrow("Max slippage tolerance must be between 0 and 0.5");
    });

    test("throws when slippage tolerance is > 0.5", async ({ client }) => {
      await expect(
        runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.51,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [
            {
              assetAddress: USDT_ADDRESS,
              supplyAmount: 1000n,
              borrowAmount: 100n,
            },
          ],
          minOutputAssets: 100n,
        })
      ).rejects.toThrow("Max slippage tolerance must be between 0 and 0.5");
    });

    test("throws when no positions", async ({ client }) => {
      await expect(
        runAaveV3PortfolioWindDownSubbundleTest({
          client,

          portfolioPercentage: 0.5,
          maxSlippageTolerance: 0.05,
          flashLoanAssetAddress: USDC_ADDRESS,
          outputAssetAddress: USDC_ADDRESS,

          initialPositions: [],
          minOutputAssets: 100n,
        })
      ).rejects.toThrow("No positions to wind down");
    });
  });
});
