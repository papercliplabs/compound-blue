import { MarketId, MathLib, ORACLE_PRICE_SCALE } from "@morpho-org/blue-sdk";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { maxUint256, parseEther, parseUnits } from "viem";
import { describe, expect } from "vitest";

import { marketRepayWithCollateralAction } from "@/actions/market/marketRepayWithCollateralAction";
import { computeAmountWithRebasingMargin } from "@/actions/utils/math";
import { BUNDLER3_ADDRESS, SUPPORTED_ADDAPTERS } from "@/utils/constants";

import { test } from "../../../config";
import { WETH_USDC_MARKET_ID } from "../../../helpers/constants";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
import { dealAndBorrowFromMorphoMarket, getMorphoMarketPosition, seedMarketLiquidity } from "../../../helpers/morpho";
import { paraswapSnapshotTest } from "../../snapshots/paraswapSnapshotTest";

const BORROW_ACCURAL_MARGIN = 1000n;

interface MarketRepayWithCollateralTestParameters {
  client: AnvilTestClient;
  marketId: MarketId;

  initialPositionCollateralAmount: bigint;
  initialPositionLoanAmount: bigint;

  loanRepayAmount: bigint;
  maxSlippageTolerance: number; // (0,1)
  callerType?: "eoa" | "contract";
}

async function runMarketRepayWithCollateralTest({
  client,
  marketId,
  initialPositionCollateralAmount,
  initialPositionLoanAmount,
  loanRepayAmount,
  maxSlippageTolerance,
  callerType = "eoa",
}: MarketRepayWithCollateralTestParameters) {
  // Arrange
  const market = await fetchMarket(marketId, client);
  const { loanToken: loanTokenAddrress, collateralToken: collateralTokenAddress } = market.params;

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  await seedMarketLiquidity(client, marketId, initialPositionLoanAmount);
  await dealAndBorrowFromMorphoMarket(client, marketId, initialPositionCollateralAmount, initialPositionLoanAmount);

  // Act
  const action = await marketRepayWithCollateralAction({
    publicClient: client,
    marketId,
    accountAddress: client.account.address,
    loanRepayAmount,
    maxSlippageTolerance,
  });
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], collateralTokenAddress); // Make sure no funds left in bundler or used adapters
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], loanTokenAddrress); // Make sure no funds left in bundler or used adapters

  const { collateralBalance: positionCollateralBalance, loanBalance: positionLoanBalance } =
    await getMorphoMarketPosition(client, marketId, client.account.address);
  const walletCollateralBalance = await getErc20BalanceOf(client, collateralTokenAddress, client.account.address);
  const price = market.price!;

  // Include a margin to account for accured interest between now and execution if closing
  // Actual swap will adjust to use true loan amount, but this get's us a maxCollateralSwapAmount needed and is used for quote (upper bound)
  const loanSwapAmount =
    loanRepayAmount == maxUint256 ? computeAmountWithRebasingMargin(initialPositionLoanAmount) : loanRepayAmount;

  // Worst case required collateral amount
  const quoteCollateralAmount = MathLib.mulDivUp(loanSwapAmount, ORACLE_PRICE_SCALE, price);
  const maxCollateralSwapAmount = MathLib.mulDivDown(
    quoteCollateralAmount,
    BigInt(Math.floor((1 + maxSlippageTolerance) * Number(MathLib.WAD))),
    MathLib.WAD
  );

  if (loanRepayAmount === maxUint256) {
    expect(positionLoanBalance).toBe(0n);
    expect(positionCollateralBalance).toBe(0n);
    expect(walletCollateralBalance).toBeGreaterThan(initialPositionCollateralAmount - maxCollateralSwapAmount);
  } else {
    expect(positionLoanBalance).toBeLessThan(initialPositionLoanAmount - loanRepayAmount + BORROW_ACCURAL_MARGIN);
    expect(positionCollateralBalance).toBeGreaterThan(initialPositionCollateralAmount - maxCollateralSwapAmount);
  }
}

const successTestCases: ({ name: string } & Omit<MarketRepayWithCollateralTestParameters, "client">)[] = [
  {
    name: "partial repayment",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("10"),
    initialPositionLoanAmount: parseUnits("10000", 6),
    loanRepayAmount: parseUnits("1000", 6),
    maxSlippageTolerance: 0.03,
  },
  {
    name: "full repayment",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("1"),
    initialPositionLoanAmount: parseUnits("100", 6),
    loanRepayAmount: maxUint256,
    maxSlippageTolerance: 0.03,
  },
];

describe("marketRepayWithCollateralAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      paraswapSnapshotTest(testCase.name + " - eoa caller", async ({ client }) => {
        await runMarketRepayWithCollateralTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      paraswapSnapshotTest(testCase.name + " - contract caller", async ({ client }) => {
        await runMarketRepayWithCollateralTest({
          client,
          ...testCase,
          callerType: "contract",
        });
      });
    });
  });

  describe("sad path", () => {
    test("throws error when market doesn't exist", async ({ client }) => {
      await expect(
        marketRepayWithCollateralAction({
          publicClient: client,
          marketId: "0x0000000000000000000000000000000000000000000000000000000000000001" as MarketId,
          accountAddress: client.account.address,
          loanRepayAmount: parseUnits("100", 6),
          maxSlippageTolerance: 0.01,
        })
      ).rejects.toThrow(); // Unknown, this is viem error
    });

    test("prepare error if loanRepayAmount is 0", async ({ client }) => {
      const action = await marketRepayWithCollateralAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        accountAddress: client.account.address,
        loanRepayAmount: 0n,
        maxSlippageTolerance: 0.01,
      });
      expect(action.status).toBe("error");
    });

    test("prepare error if slippage tolerance is 0", async ({ client }) => {
      const action = await marketRepayWithCollateralAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        accountAddress: client.account.address,
        loanRepayAmount: 0n,
        maxSlippageTolerance: 0,
      });
      expect(action.status).toBe("error");
    });

    // This is hard to test, would need to hook into the paraswap contract somehow
    // This is inforced at the adapter contract level, so just need to make sure the offsets are correct (see paraswapOffsetLookup.test.ts)
    // test("tx reverts if slippage tolerance is exceeded", async ({ client }) => {
    // });
  });
});
