import { MarketId } from "@morpho-org/blue-sdk";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, parseEther, parseUnits } from "viem";
import { describe, expect } from "vitest";

import { aaveV3PortfolioMigrationToMarketAction } from "@/actions/migration/aaveV3PortfolioMigrationToMarketAction";
import { USDC_ADDRESS, WBTC_ADDRESS } from "@/config";
import { BUNDLER3_ADDRESS, SUPPORTED_ADDAPTERS } from "@/utils/constants";

import { test } from "../../../config";
import { dealAndSupplyToAaveV3 } from "../../../helpers/aaveV3";
import { borrowFromAaveV3 } from "../../../helpers/aaveV3";
import {
  DAI_ADDRESS,
  USDT_ADDRESS,
  WETH_ADDRESS,
  WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
  WETH_USDC_MARKET_ID,
} from "../../../helpers/constants";
import { expectZeroErc20Balances } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
import { getMorphoMarketPosition, seedMarketLiquidity } from "../../../helpers/morpho";
import { paraswapSnapshotTest } from "../../snapshots/paraswapSnapshotTest";

interface RunAaveV3PortfolioMigrationToMarketActionTestParameters {
  client: AnvilTestClient;

  portfolioPercentage: number;
  maxSlippageTolerance: number;

  marketId: MarketId;
  allocatingVaultAddresses: Address[];
  borrowAmount: bigint;

  // Must be correctly collateralized
  initialPositions: { assetAddress: Address; supplyAmount: bigint; borrowAmount: bigint }[];

  minCollateralAmount: bigint;
}

async function runAaveV3PortfolioMigrationToMarketActionTest({
  client,

  portfolioPercentage,
  maxSlippageTolerance,

  marketId,
  allocatingVaultAddresses,
  borrowAmount,

  initialPositions,
  minCollateralAmount,
}: RunAaveV3PortfolioMigrationToMarketActionTestParameters) {
  // Arrange
  const collateralPositions = initialPositions.filter((p) => p.supplyAmount > 0n);
  const borrowPositions = initialPositions.filter((p) => p.borrowAmount > 0n);

  for (const p of collateralPositions) {
    await dealAndSupplyToAaveV3(client, p.assetAddress, p.supplyAmount, true);
  }
  for (const p of borrowPositions) {
    await borrowFromAaveV3(client, p.assetAddress, p.borrowAmount);
  }

  await seedMarketLiquidity(client, marketId, borrowAmount);

  // Act
  const action = await aaveV3PortfolioMigrationToMarketAction({
    publicClient: client,
    accountAddress: client.account.address,

    portfolioPercentage,
    maxSlippageTolerance,

    marketId,
    allocatingVaultAddresses,
    borrowAmount,
  });
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected

  // Make sure no dust left anywhere
  for (const p of initialPositions) {
    await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], p.assetAddress);
  }

  const positionBalance = await getMorphoMarketPosition(client, marketId, client.account.address);
  expect(positionBalance.collateralBalance).toBeGreaterThanOrEqual(minCollateralAmount);
  expect(positionBalance.loanBalance).toBeWithinRange(borrowAmount - 1n, borrowAmount + 1n); // For rounding
}

const initialPositions = [
  { assetAddress: USDC_ADDRESS, supplyAmount: parseUnits("1000", 6), borrowAmount: parseUnits("10", 6) }, // 1000, 10
  { assetAddress: USDT_ADDRESS, supplyAmount: parseUnits("2000", 6), borrowAmount: parseUnits("500", 6) }, // 2000, 500
  { assetAddress: WETH_ADDRESS, supplyAmount: parseEther("1"), borrowAmount: parseEther("0") }, // 2330, 0
  { assetAddress: DAI_ADDRESS, supplyAmount: parseUnits("0", 18), borrowAmount: parseUnits("2000", 18) }, // 0, 2000
  { assetAddress: WBTC_ADDRESS, supplyAmount: parseUnits("0", 8), borrowAmount: parseUnits("0.01", 8) }, // 0, 1031
];

// Total supply value USD: 5330
// Total borrow value USD: 3541
// Total delta USD: 1789 => ~0.76 ETH

describe("aaveV3PortfolioMigrationToMarketAction", () => {
  describe("happy path", () => {
    paraswapSnapshotTest("partial migration, WETH-USDC market", async ({ client }) => {
      await runAaveV3PortfolioMigrationToMarketActionTest({
        client,

        portfolioPercentage: 0.5,
        maxSlippageTolerance: 0.015,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        borrowAmount: parseUnits("100", 6),

        initialPositions,
        minCollateralAmount: parseEther("0.37"), // Need to update if taking a new snapshot to reflect ETH price
      });
    });
    paraswapSnapshotTest("full migration, WETH-USDC market", async ({ client }) => {
      await runAaveV3PortfolioMigrationToMarketActionTest({
        client,

        portfolioPercentage: 1,
        maxSlippageTolerance: 0.015,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        borrowAmount: parseUnits("400", 6),

        initialPositions,
        minCollateralAmount: parseEther("0.74"), // Need to update if taking a new snapshot to reflect ETH price
      });
    });
  });

  describe("sad path", () => {
    test("portfolio percentage is 0", async ({ client }) => {
      const action = await aaveV3PortfolioMigrationToMarketAction({
        publicClient: client,
        accountAddress: client.account.address,

        portfolioPercentage: 0,
        maxSlippageTolerance: 0.015,

        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        borrowAmount: parseUnits("100", 6),
      });
      expect(action.status).toEqual("error");

      if (action.status == "error") {
        expect(action.message).toEqual(
          "Simulation Error: Portfolio percentage must be between 0 (exclusive) and 1 (inclusive)"
        );
      }
    });
    test("portfolio percentage is >1", async ({ client }) => {
      const action = await aaveV3PortfolioMigrationToMarketAction({
        publicClient: client,
        accountAddress: client.account.address,

        portfolioPercentage: 1.1,
        maxSlippageTolerance: 0.015,

        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        borrowAmount: parseUnits("100", 6),
      });
      expect(action.status).toEqual("error");

      if (action.status == "error") {
        expect(action.message).toEqual(
          "Simulation Error: Portfolio percentage must be between 0 (exclusive) and 1 (inclusive)"
        );
      }
    });
    test("slippage is 0", async ({ client }) => {
      const action = await aaveV3PortfolioMigrationToMarketAction({
        publicClient: client,
        accountAddress: client.account.address,

        portfolioPercentage: 0.5,
        maxSlippageTolerance: 0,

        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        borrowAmount: parseUnits("100", 6),
      });
      expect(action.status).toEqual("error");

      if (action.status == "error") {
        expect(action.message).toEqual("Simulation Error: Max slippage tolerance must be between 0 and 0.5");
      }
    });
    test("slippage is >0.5", async ({ client }) => {
      const action = await aaveV3PortfolioMigrationToMarketAction({
        publicClient: client,
        accountAddress: client.account.address,

        portfolioPercentage: 0.5,
        maxSlippageTolerance: 0.51,

        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        borrowAmount: parseUnits("100", 6),
      });
      expect(action.status).toEqual("error");

      if (action.status == "error") {
        expect(action.message).toEqual("Simulation Error: Max slippage tolerance must be between 0 and 0.5");
      }
    });
  });
});
