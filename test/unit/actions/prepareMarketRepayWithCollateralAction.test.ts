import { describe, expect } from "vitest";
import { test } from "../../setup";
import { maxUint256, parseEther, parseUnits } from "viem";
import { WETH_USDC_MARKET_ID } from "../../helpers/constants";
import { dealAndBorrowFromMorphoMarket, getMorphoMarketAccountBalances } from "../../helpers/morpho";
import { prepareMarketRepayWithCollateralAction } from "@/actions/prepareMarketRepayWithCollateralAction";
import { executeAction } from "../../helpers/actions";
import { AnvilTestClient } from "@morpho-org/test";
import { MarketId } from "@morpho-org/blue-sdk";

interface RunMarketRepayWithCollateralTestParameters {
  client: AnvilTestClient;
  marketId: MarketId;
  initialCollateralAmount: bigint;
  initialLoanAmount: bigint;
  loanRepayAmount: bigint;
  maxSlippageTolerance: number; // (0,1)
  delayBlocks: number;
  checks: {
    collateralBalanceFinalLimits: {
      min: bigint;
      max: bigint;
    };
    loanBalanceFinalLimits: {
      min: bigint;
      max: bigint;
    };
  };
}

async function runMarketRepayWithCollateralTest({
  client,
  marketId,
  initialCollateralAmount,
  initialLoanAmount,
  loanRepayAmount,
  maxSlippageTolerance,
  checks,
}: RunMarketRepayWithCollateralTestParameters) {
  // Arrange
  await dealAndBorrowFromMorphoMarket(client, marketId, initialCollateralAmount, initialLoanAmount);

  // Act
  const action = await prepareMarketRepayWithCollateralAction({
    publicClient: client,
    accountAddress: client.account.address,
    marketId: marketId,
    loanRepayAmount: loanRepayAmount,
    maxSlippageTolerance,
  });
  await executeAction(client, action);

  // Assert
  const { collateralBalance, loanBalance } = await getMorphoMarketAccountBalances(client, WETH_USDC_MARKET_ID);
  expect(collateralBalance).toBeWithinRange(
    checks.collateralBalanceFinalLimits.min,
    checks.collateralBalanceFinalLimits.max
  );
  expect(loanBalance).toBeWithinRange(checks.loanBalanceFinalLimits.min, checks.loanBalanceFinalLimits.max);
}

describe("prepareMarketRepayWithCollateralAction", () => {
  test("partial repayment with collateral", async ({ client }) => {
    const marketId = WETH_USDC_MARKET_ID;
    const initialCollateralAmount = parseEther("10");
    const initialLoanAmount = parseUnits("10000", 6);
    const loanRepayAmount = initialLoanAmount / BigInt(2);

    await runMarketRepayWithCollateralTest({
      client,
      marketId,
      initialCollateralAmount,
      initialLoanAmount,
      loanRepayAmount,
      maxSlippageTolerance: 0.01,
      delayBlocks: 0,
      checks: {
        // TODO: set this...
        collateralBalanceFinalLimits: {
          min: BigInt(0),
          max: maxUint256,
        },
        loanBalanceFinalLimits: {
          min: initialLoanAmount - loanRepayAmount,
          max: initialLoanAmount - loanRepayAmount + BigInt(1),
        },
      },
    });
  });

  test.only("full repayment with collateral", async ({ client }) => {
    const marketId = WETH_USDC_MARKET_ID;
    const initialCollateralAmount = parseEther("10");
    const initialLoanAmount = parseUnits("10000", 6);
    const loanRepayAmount = maxUint256;

    await runMarketRepayWithCollateralTest({
      client,
      marketId,
      initialCollateralAmount,
      initialLoanAmount,
      loanRepayAmount,
      maxSlippageTolerance: 0.01,
      delayBlocks: 0,
      checks: {
        collateralBalanceFinalLimits: {
          min: BigInt(0),
          max: maxUint256,
        },
        loanBalanceFinalLimits: {
          min: BigInt(0),
          max: BigInt(0),
        },
      },
    });
  });
});
