import { MarketId, MathLib } from "@morpho-org/blue-sdk";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, maxUint256, parseEther } from "viem";
import { describe, expect, vi } from "vitest";

import { marketLeveragedBorrowAction } from "@/actions/market/marketLeverageBorrowAction";
import { BUNDLER3_ADDRESS, SUPPORTED_ADDAPTERS } from "@/utils/constants";

import { test } from "../../../config";
import { WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS, WETH_USDC_MARKET_ID } from "../../../helpers/constants";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
import { getMorphoMarketPosition } from "../../../helpers/morpho";
import { paraswapSnapshotTest } from "../../snapshots/paraswapSnapshotTest";

vi.mock("@/data/paraswap/getParaswapExactBuy");

interface MarketLeveragedBorrowTestParameters {
  client: AnvilTestClient;
  marketId: MarketId;
  allocatingVaultAddresses: Address[];

  initialCollateralAmount: bigint;
  leverageFactor: number;
  maxSlippageTolerance: number;

  collateralDealAmount: bigint;
  callerType?: "eoa" | "contract";
}

async function runMarketLeveragedBorrowTest({
  client,
  marketId,

  allocatingVaultAddresses,
  initialCollateralAmount,
  leverageFactor,
  maxSlippageTolerance,

  collateralDealAmount = initialCollateralAmount,
  callerType,
}: MarketLeveragedBorrowTestParameters) {
  // Arrange
  const market = await fetchMarket(marketId, client);
  const { loanToken: loanTokenAddress, collateralToken: collateralTokenAddress } = market.params;

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  await client.deal({ erc20: collateralTokenAddress, amount: collateralDealAmount });

  // Act
  const action = await marketLeveragedBorrowAction({
    publicClient: client,
    marketId,
    allocatingVaultAddresses,

    accountAddress: client.account.address,

    initialCollateralAmount,
    leverageFactor,
    maxSlippageTolerance,
  });
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected

  const { collateralBalance: positionCollateralBalance, loanBalance: positionLoanBalance } =
    await getMorphoMarketPosition(client, marketId, client.account.address);
  const walletCollateralBalance = await getErc20BalanceOf(client, collateralTokenAddress, client.account.address);

  const initialCollateralInternal =
    initialCollateralAmount == maxUint256 ? collateralDealAmount : initialCollateralAmount;

  const finalCollateralAmount = MathLib.mulDivDown(
    initialCollateralInternal,
    BigInt(leverageFactor * Number(MathLib.WAD)),
    MathLib.WAD
  );

  expect(walletCollateralBalance).toBeGreaterThanOrEqual(collateralDealAmount - initialCollateralInternal); // Positive slippage means could be greater than
  expect(positionCollateralBalance).toBe(finalCollateralAmount);

  const borrowAmount = market.getCollateralValue(finalCollateralAmount - initialCollateralInternal)!;
  const maxBorrowAmount = MathLib.mulDivUp(
    borrowAmount,
    BigInt((1 + maxSlippageTolerance) * Number(MathLib.WAD)),
    MathLib.WAD
  );

  expect(positionLoanBalance).toBeLessThanOrEqual(maxBorrowAmount);

  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], loanTokenAddress);
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], collateralTokenAddress);
}

const successTestCases: ({ name: string } & Omit<MarketLeveragedBorrowTestParameters, "client">)[] = [
  {
    name: "leverage with partial wallet balance collateral",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,

    initialCollateralAmount: parseEther("1"),
    leverageFactor: 2.1,
    maxSlippageTolerance: 0.05,

    collateralDealAmount: parseEther("2"),
  },
  {
    name: "leverage with exact wallet balance collateral",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,

    initialCollateralAmount: parseEther("2"),
    leverageFactor: 4.1,
    maxSlippageTolerance: 0.05,

    collateralDealAmount: parseEther("2"),
  },
];

describe("marketLeveragedBorrowAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      paraswapSnapshotTest(testCase.name + " - eoa caller", async ({ client }) => {
        await runMarketLeveragedBorrowTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      paraswapSnapshotTest(testCase.name + " - contract caller", async ({ client }) => {
        await runMarketLeveragedBorrowTest({
          client,
          ...testCase,
          callerType: "contract",
        });
      });
    });
  });

  describe("sad path", () => {
    test("prepare error when leverage factor < 1", async ({ client }) => {
      const action = await marketLeveragedBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,

        accountAddress: client.account.address,

        initialCollateralAmount: parseEther("1"),
        leverageFactor: 0.9,
        maxSlippageTolerance: 0.05,
      });
      expect(action.status).toEqual("error");
    });
    test("prepare error when slippage tolerance is too large", async ({ client }) => {
      const action = await marketLeveragedBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,

        accountAddress: client.account.address,

        initialCollateralAmount: parseEther("1"),
        leverageFactor: 1.4,
        maxSlippageTolerance: 1.2,
      });
      expect(action.status).toEqual("error");
    });
    test("prepare error when leverage factor is too large", async ({ client }) => {
      const action = await marketLeveragedBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,

        accountAddress: client.account.address,

        initialCollateralAmount: parseEther("1"),
        leverageFactor: 20,
        maxSlippageTolerance: 0.05,
      });
      expect(action.status).toEqual("error");
    });
    test("prepare error when initial collateral amount is maxUint256", async ({ client }) => {
      const action = await marketLeveragedBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,

        accountAddress: client.account.address,

        initialCollateralAmount: maxUint256,
        leverageFactor: 20,
        maxSlippageTolerance: 0.05,
      });
      expect(action.status).toEqual("error");
      if (action.status === "error") {
        expect(action.message).toBe("Initial collateral amount cannot be greater than or equal to max uint256");
      }
    });
  });
});
