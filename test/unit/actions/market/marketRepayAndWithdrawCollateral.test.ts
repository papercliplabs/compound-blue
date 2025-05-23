import { MarketId } from "@morpho-org/blue-sdk";
import { blueAbi, fetchMarket } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { Hex, maxUint256, parseEther, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { describe, expect } from "vitest";

import { marketRepayAndWithdrawCollateralAction } from "@/actions/market/marketRepayAndWithdrawCollateralAction";
import { bigIntMax } from "@/utils/bigint";
import { BUNDLER3_ADDRESS, MORPHO_BLUE_ADDRESS, SUPPORTED_ADDAPTERS } from "@/utils/constants";

import { test } from "../../../config";
import { WETH_ADDRESS, WETH_USDC_MARKET_ID } from "../../../helpers/constants";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
import { dealAndBorrowFromMorphoMarket, getMorphoMarketPosition, seedMarketLiquidity } from "../../../helpers/morpho";

interface MarketRepayAndWithdrawCollateralTestParameters {
  client: AnvilTestClient;
  marketId: MarketId;

  // Initial state
  initialPositionCollateralAmount: bigint;
  initialPositionLoanAmount: bigint;
  initialWalletLoanAssetAmount: bigint;

  // Action params
  repayAmount: bigint;
  withdrawCollateralAmount: bigint;

  beforeExecutionCb?: (client: AnvilTestClient) => Promise<void>;
  callerType?: "eoa" | "contract";
}

async function runRepayAndWithdrawCollateralTest({
  client,
  marketId,
  initialPositionCollateralAmount,
  initialPositionLoanAmount,
  initialWalletLoanAssetAmount,
  repayAmount,
  withdrawCollateralAmount,
  beforeExecutionCb,
  callerType = "eoa",
}: MarketRepayAndWithdrawCollateralTestParameters) {
  // Arrange
  const market = await fetchMarket(marketId, client);
  const { loanToken: loanTokenAddrress, collateralToken: collateralTokenAddress } = market.params;

  await seedMarketLiquidity(client, marketId, initialPositionLoanAmount * 2n);
  await dealAndBorrowFromMorphoMarket(client, marketId, initialPositionCollateralAmount, initialPositionLoanAmount);
  await client.deal({ erc20: loanTokenAddrress, amount: initialWalletLoanAssetAmount });

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  // Act
  const action = await marketRepayAndWithdrawCollateralAction({
    publicClient: client,
    marketId,
    accountAddress: client.account.address,
    repayAmount,
    withdrawCollateralAmount,
  });
  await beforeExecutionCb?.(client);
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected

  const { collateralBalance: positionCollateralBalance, loanBalance: positionLoanBalance } =
    await getMorphoMarketPosition(client, marketId, client.account.address);

  const walletCollateralBalance = await getErc20BalanceOf(client, collateralTokenAddress, client.account.address);
  const walletLoanBalance = await getErc20BalanceOf(client, loanTokenAddrress, client.account.address);

  if (repayAmount === maxUint256) {
    expect(positionLoanBalance).toEqual(BigInt(0));
    expect(walletLoanBalance).toBeWithinRange(
      initialWalletLoanAssetAmount - initialPositionLoanAmount - BigInt(1),
      initialWalletLoanAssetAmount - initialPositionLoanAmount
    );
  } else {
    expect(positionLoanBalance).toBeWithinRange(
      initialPositionLoanAmount - repayAmount,
      initialPositionLoanAmount - repayAmount + BigInt(1)
    );
    expect(walletLoanBalance).toBeWithinRange(
      bigIntMax(initialWalletLoanAssetAmount - repayAmount - BigInt(1), BigInt(0)),
      initialWalletLoanAssetAmount - repayAmount
    );
  }

  if (withdrawCollateralAmount === maxUint256) {
    expect(positionCollateralBalance).toEqual(BigInt(0));
    expect(walletCollateralBalance).toEqual(initialPositionCollateralAmount);
  } else {
    expect(positionCollateralBalance).toEqual(initialPositionCollateralAmount - withdrawCollateralAmount);
    expect(walletCollateralBalance).toEqual(withdrawCollateralAmount);
  }

  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], loanTokenAddrress);
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], collateralTokenAddress);
}

const successTestCases: ({ name: string } & Omit<MarketRepayAndWithdrawCollateralTestParameters, "client">)[] = [
  {
    name: "no repay, partial withdraw collateral",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("100"), // WETH
    initialPositionLoanAmount: parseUnits("100", 6), // USDC
    initialWalletLoanAssetAmount: parseEther("10"),
    repayAmount: BigInt(0),
    withdrawCollateralAmount: parseEther("1"), // WETH
  },
  {
    name: "partial repay, no withdraw collateral",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("100"), // WETH
    initialPositionLoanAmount: parseUnits("100", 6), // USDC
    initialWalletLoanAssetAmount: parseEther("10"),
    repayAmount: parseUnits("10", 6), // USDC
    withdrawCollateralAmount: BigInt(0),
  },
  {
    name: "partial repay, partial withdraw collateral",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("100"), // WETH
    initialPositionLoanAmount: parseUnits("100", 6), // USDC
    initialWalletLoanAssetAmount: parseEther("10"),
    repayAmount: parseUnits("10", 6), // USDC
    withdrawCollateralAmount: parseEther("1"), // WETH
  },
  {
    name: "full repay, no withdraw collateral",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("100"), // WETH
    initialPositionLoanAmount: parseUnits("100", 6), // USDC
    initialWalletLoanAssetAmount: parseEther("10"),
    repayAmount: maxUint256,
    withdrawCollateralAmount: BigInt(0),
  },
  {
    name: "full repay, partial withdraw collateral",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("100"), // WETH
    initialPositionLoanAmount: parseUnits("100", 6), // USDC
    initialWalletLoanAssetAmount: parseEther("10"),
    repayAmount: maxUint256,
    withdrawCollateralAmount: parseEther("1"), // WETH
  },
  {
    name: "full repay, full withdraw collateral",
    marketId: WETH_USDC_MARKET_ID,
    initialPositionCollateralAmount: parseEther("100"), // WETH
    initialPositionLoanAmount: parseUnits("100", 6), // USDC
    initialWalletLoanAssetAmount: parseEther("10"),
    repayAmount: maxUint256,
    withdrawCollateralAmount: maxUint256,
  },
];

describe("marketRepayAndWithdrawCollateralAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      test(testCase.name + " - eoa caller", async ({ client }) => {
        await runRepayAndWithdrawCollateralTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      test(testCase.name + " - contract caller", async ({ client }) => {
        await runRepayAndWithdrawCollateralTest({
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
        marketRepayAndWithdrawCollateralAction({
          publicClient: client,
          marketId: "0x0000000000000000000000000000000000000000000000000000000000000001" as MarketId,
          accountAddress: client.account.address,
          repayAmount: parseUnits("100", 6),
          withdrawCollateralAmount: parseEther("1"),
        })
      ).rejects.toThrow(); // Unknown, this is viem error
    });
    test("prepare error if repay and withdraw collateral amount are both 0", async ({ client }) => {
      await seedMarketLiquidity(client, WETH_USDC_MARKET_ID, parseEther("100"));
      await dealAndBorrowFromMorphoMarket(client, WETH_USDC_MARKET_ID, parseEther("10"), parseUnits("100", 6));
      await client.deal({ erc20: WETH_ADDRESS, amount: parseEther("100") });
      const action = await marketRepayAndWithdrawCollateralAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        accountAddress: client.account.address,
        repayAmount: BigInt(0),
        withdrawCollateralAmount: BigInt(0),
      });
      expect(action.status).toBe("error");
    });
    test("prepare error if repay exceeds wallet balance", async ({ client }) => {
      const action = await marketRepayAndWithdrawCollateralAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        accountAddress: client.account.address,
        repayAmount: BigInt(10),
        withdrawCollateralAmount: BigInt(0),
      });
      expect(action.status).toBe("error");
    });
    test("prepare error if withdraw collateral exceeds position balance", async ({ client }) => {
      const action = await marketRepayAndWithdrawCollateralAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        accountAddress: client.account.address,
        repayAmount: BigInt(0),
        withdrawCollateralAmount: BigInt(10),
      });
      expect(action.status).toBe("error");
    });
    test("prepare error if loan is not sufficiently collateralized", async ({ client }) => {
      await seedMarketLiquidity(client, WETH_USDC_MARKET_ID, parseEther("100"));
      await dealAndBorrowFromMorphoMarket(client, WETH_USDC_MARKET_ID, parseEther("10"), parseUnits("100", 6));
      const action = await marketRepayAndWithdrawCollateralAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        accountAddress: client.account.address,
        repayAmount: BigInt(0),
        withdrawCollateralAmount: maxUint256,
      });
      expect(action.status).toBe("error");
    });
    test.sequential("tx reverts if slippage tolerance is exceeded", async ({ client }) => {
      const marketId = WETH_USDC_MARKET_ID;
      await expect(
        runRepayAndWithdrawCollateralTest({
          client,
          marketId,
          initialPositionCollateralAmount: parseEther("100"),
          initialPositionLoanAmount: parseUnits("100", 6),
          initialWalletLoanAssetAmount: parseEther("10"),
          repayAmount: parseUnits("5", 6),
          withdrawCollateralAmount: BigInt(0),
          beforeExecutionCb: async () => {
            const [, , totalBorrowAssets] = await readContract(client, {
              address: MORPHO_BLUE_ADDRESS,
              abi: blueAbi,
              functionName: "market",
              args: [marketId],
            });
            // Induce 0.05% slippage
            const newTotalBorrowAssets =
              (totalBorrowAssets * BigInt(Math.floor((1 + 0.0005) * 100000))) / BigInt(100000);
            const borrowSlot = "0xad97df8fd2b1e746589dc0a75093fa941d168d24e64cd6480826944631800265" as Hex; // totalBorrowAssets in lower 128 bits, totalBorrowShares in upper 128 bits
            const slotVal = await client.getStorageAt({
              address: MORPHO_BLUE_ADDRESS,
              slot: borrowSlot,
            });
            // Extract upper 128 bits (borrowShares)
            const totalBorrowShares = BigInt(slotVal!) >> BigInt(128);
            const newVal = (totalBorrowShares << BigInt(128)) | newTotalBorrowAssets;
            const newSlotVal = `0x${newVal.toString(16).padStart(64, "0")}`;
            // Override totalBorrowAssets to cause slippage
            await client.setStorageAt({
              address: MORPHO_BLUE_ADDRESS,
              index: borrowSlot,
              value: newSlotVal as Hex,
            });
          },
        })
      ).rejects.toThrow("action-tx-reverted");
    });
  });
});
