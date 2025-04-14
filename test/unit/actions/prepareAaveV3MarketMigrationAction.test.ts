import { describe, expect } from "vitest";
import { prepareAaveV3MarketMigrationAction } from "@/actions/prepareAaveV3MarketMigrationAction";
import { test } from "../../setup";
import { Address, maxUint256, parseEther, parseUnits } from "viem";
import { addresses } from "@morpho-org/blue-sdk";
import {
  borrowFromAaveV3,
  dealAndSupplyToAaveV3,
  getAaveV3LoanBalance,
  getAaveV3SupplyBalance,
} from "../../helpers/aaveV3";
import { executeAction } from "../../helpers/executeAction";
import { expectZeroErc20Balances } from "../../helpers/erc20";
import { CHAIN_ID } from "@/config";
import { AnvilTestClient } from "@morpho-org/test";
import { WETH_ADDRESS, USDC_ADDRESS, USDT_ADDRESS, WETH_USDC_MARKET_ID } from "../../helpers/constants";
import { getMorphoMarketPosition } from "../../helpers/morpho";

const ALLOCATING_VAULT_ADDRESS: Address[] = ["0x781FB7F6d845E3bE129289833b04d43Aa8558c42"];

const REBASEING_MARGIN = BigInt(100030);
const REBASEING_MARGIN_SCALE = BigInt(100000);

const {
  bundler3: { bundler3, aaveV3CoreMigrationAdapter, generalAdapter1 },
} = addresses[CHAIN_ID];

async function fullPositionMigrationWithDelay(
  client: AnvilTestClient,
  delayBlocks: number,
  collateralTokenAmount?: bigint,
  loanTokenAmount?: bigint
) {
  const WETH_COLLATERAL_AMOUNT = collateralTokenAmount ?? parseEther("1");
  const USDC_LOAN_AMOUNT = loanTokenAmount ?? parseUnits("100", 6);

  // Arrange
  await dealAndSupplyToAaveV3(client, WETH_ADDRESS, WETH_COLLATERAL_AMOUNT, true);
  await borrowFromAaveV3(client, USDC_ADDRESS, USDC_LOAN_AMOUNT);
  const aaveCollateralBalanceInital = await getAaveV3SupplyBalance(client, WETH_ADDRESS);
  const aaveLoanBalanceInital = await getAaveV3LoanBalance(client, USDC_ADDRESS);

  // Act
  const action = await prepareAaveV3MarketMigrationAction({
    publicClient: client,
    accountAddress: client.account.address,
    marketId: WETH_USDC_MARKET_ID,
    collateralTokenAmount: maxUint256,
    loanTokenAmount: maxUint256,
    allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
  });

  // Fast forward some time as this should still work with a time delay for execution (<1 day after creation)
  await client.mine({ blocks: delayBlocks });
  await executeAction(client, action);

  // Assert
  // Check aave v3 balances
  const aaveV3CollateralBalanceFinal = await getAaveV3SupplyBalance(client, WETH_ADDRESS);
  const aaveV3LoanBalanceFinal = await getAaveV3LoanBalance(client, USDC_ADDRESS);
  expect(aaveV3CollateralBalanceFinal).toEqual(BigInt(0));
  expect(aaveV3LoanBalanceFinal).toEqual(BigInt(0));

  // Check Morpho balances
  const { collateralBalance: morphoCollateralBalanceFinal, loanBalance: morphoLoanBalanceFinal } =
    await getMorphoMarketPosition(client, WETH_USDC_MARKET_ID);

  const minCollateralBalance = aaveCollateralBalanceInital;
  const maxCollateralBalance = (minCollateralBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
  expect(morphoCollateralBalanceFinal).toBeWithinRange(minCollateralBalance, maxCollateralBalance);

  // The loan amount for full debt repayments always has the full buffer, +1 since rounded up
  const minLoanBalance = aaveLoanBalanceInital;
  const maxLoanBalance = (minLoanBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
  expect(morphoLoanBalanceFinal).toBeWithinRange(minLoanBalance, maxLoanBalance);

  await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], WETH_ADDRESS);
  await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], USDC_ADDRESS);
}

describe("prepareAaveV3MarketMigrationAction", () => {
  describe.concurrent("full position migration", () => {
    test.concurrent("should migrate full position with no delay between creation and execution", async ({ client }) => {
      await fullPositionMigrationWithDelay(client, 0);
    });
    test.concurrent(
      "should migrate full position with <1 day delay between creation and execution",
      async ({ client }) => {
        await fullPositionMigrationWithDelay(client, 10000);
      }
    );
    test.concurrent(
      "should fail when migrating full position with >1 day delay between creation and execution",
      async ({ client }) => {
        await expect(fullPositionMigrationWithDelay(client, 500000)).rejects.toThrow("tx failed");
      }
    );
    test.concurrent("should migrate full position with public reallocation", async ({ client }) => {
      await fullPositionMigrationWithDelay(client, 0, parseEther("10000"), parseUnits("6300000", 6));
    });
  });

  describe.concurrent("partial position migration", () => {
    test.concurrent("should migrate full collataeral, partial loan position", async ({ client }) => {
      const wethCollateralAmount = parseEther("1");
      const usdtCollateralAmount = parseUnits("5000", 6);
      const usdcLoanAmount = parseUnits("100", 6);
      const usdcLoanMigrationAmount = usdcLoanAmount / BigInt(2);

      // Arrange
      await dealAndSupplyToAaveV3(client, WETH_ADDRESS, wethCollateralAmount, true);
      await dealAndSupplyToAaveV3(client, USDT_ADDRESS, usdtCollateralAmount, true);
      await borrowFromAaveV3(client, USDC_ADDRESS, usdcLoanAmount);
      const aaveLoanBalanceInital = await getAaveV3LoanBalance(client, USDC_ADDRESS);

      // Act
      const action = await prepareAaveV3MarketMigrationAction({
        publicClient: client,
        accountAddress: client.account.address,
        marketId: WETH_USDC_MARKET_ID,
        collateralTokenAmount: maxUint256,
        loanTokenAmount: usdcLoanMigrationAmount,
        allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
      });
      await executeAction(client, action);

      // Assert
      // Check aave v3 balances
      const aaveV3CollateralBalanceFinal = await getAaveV3SupplyBalance(client, WETH_ADDRESS);
      const aaveV3LoanBalanceFinal = await getAaveV3LoanBalance(client, USDC_ADDRESS);

      expect(aaveV3CollateralBalanceFinal).toEqual(BigInt(0));

      const minLoanBalance = aaveLoanBalanceInital - usdcLoanMigrationAmount;
      const maxLoanBalance = (minLoanBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
      expect(aaveV3LoanBalanceFinal).toBeWithinRange(minLoanBalance, maxLoanBalance);

      // Check morpho balances
      const { collateralBalance: morphoCollateralBalanceFinal, loanBalance: morphoLoanBalanceFinal } =
        await getMorphoMarketPosition(client, WETH_USDC_MARKET_ID);

      expect(morphoCollateralBalanceFinal).toBeGreaterThanOrEqual(wethCollateralAmount);

      const minMorphoLoanBalance = usdcLoanMigrationAmount;
      const maxMorphoLoanBalance = (minMorphoLoanBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
      expect(morphoLoanBalanceFinal).toBeWithinRange(minMorphoLoanBalance, maxMorphoLoanBalance);

      // Make sure bundler3 and adapters have been swept
      await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], WETH_ADDRESS);
      await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], USDC_ADDRESS);
    });
    test.concurrent("should migrate partial collataeral, full loan position", async ({ client }) => {
      const wethCollateralAmount = parseEther("1");
      const usdcLoanAmount = parseUnits("100", 6);
      const collateralMigrationAmount = wethCollateralAmount / BigInt(2);

      // Arrange
      await dealAndSupplyToAaveV3(client, WETH_ADDRESS, wethCollateralAmount, true);
      await borrowFromAaveV3(client, USDC_ADDRESS, usdcLoanAmount);
      const aaveCollateralBalanceInital = await getAaveV3SupplyBalance(client, WETH_ADDRESS);

      // Act
      const action = await prepareAaveV3MarketMigrationAction({
        publicClient: client,
        accountAddress: client.account.address,
        marketId: WETH_USDC_MARKET_ID,
        collateralTokenAmount: collateralMigrationAmount,
        loanTokenAmount: maxUint256,
        allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
      });
      await executeAction(client, action);

      // Assert
      // Check aave v3 balances
      const aaveV3CollateralBalanceFinal = await getAaveV3SupplyBalance(client, WETH_ADDRESS);
      const aaveV3LoanBalanceFinal = await getAaveV3LoanBalance(client, USDC_ADDRESS);

      const minCollateralBalance = aaveCollateralBalanceInital - collateralMigrationAmount;
      const maxCollateralBalance = (minCollateralBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
      expect(aaveV3CollateralBalanceFinal).toBeWithinRange(minCollateralBalance, maxCollateralBalance);

      expect(aaveV3LoanBalanceFinal).toEqual(BigInt(0));

      // Check morpho balances
      const { collateralBalance: morphoCollateralBalanceFinal, loanBalance: morphoLoanBalanceFinal } =
        await getMorphoMarketPosition(client, WETH_USDC_MARKET_ID);

      expect(morphoCollateralBalanceFinal).toBeGreaterThanOrEqual(collateralMigrationAmount);

      // The loan amount for full debt repayments always has the full buffer, +1 since rounded up
      const minLoanBalance = usdcLoanAmount;
      const maxLoanBalance = (minLoanBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
      expect(morphoLoanBalanceFinal).toBeWithinRange(minLoanBalance, maxLoanBalance);

      // Make sure bundler3 and adapters have been swept
      await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], WETH_ADDRESS);
      await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], USDC_ADDRESS);
    });
    test.concurrent("should migrate partial collateral, partial loan position", async ({ client }) => {
      const wethCollateralAmount = parseEther("1");
      const usdcLoanAmount = parseUnits("100", 6);
      const collateralMigrationAmount = wethCollateralAmount / BigInt(2);
      const loanMigrationAmount = usdcLoanAmount / BigInt(2);

      // Arrange
      await dealAndSupplyToAaveV3(client, WETH_ADDRESS, wethCollateralAmount, true);
      await borrowFromAaveV3(client, USDC_ADDRESS, usdcLoanAmount);
      const aaveCollateralBalanceInital = await getAaveV3SupplyBalance(client, WETH_ADDRESS);
      const aaveLoanBalanceInital = await getAaveV3LoanBalance(client, USDC_ADDRESS);

      // Act
      const action = await prepareAaveV3MarketMigrationAction({
        publicClient: client,
        accountAddress: client.account.address,
        marketId: WETH_USDC_MARKET_ID,
        collateralTokenAmount: collateralMigrationAmount,
        loanTokenAmount: loanMigrationAmount,
        allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
      });
      await executeAction(client, action);

      // Assert
      // Check aave v3 balances
      const aaveV3CollateralBalanceFinal = await getAaveV3SupplyBalance(client, WETH_ADDRESS);
      const aaveV3LoanBalanceFinal = await getAaveV3LoanBalance(client, USDC_ADDRESS);

      const minCollateralBalance = aaveCollateralBalanceInital - collateralMigrationAmount;
      const maxCollateralBalance = (minCollateralBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
      expect(aaveV3CollateralBalanceFinal).toBeWithinRange(minCollateralBalance, maxCollateralBalance);

      const minLoanBalance = aaveLoanBalanceInital - loanMigrationAmount;
      const maxLoanBalance = (minLoanBalance * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE;
      expect(aaveV3LoanBalanceFinal).toBeWithinRange(minLoanBalance, maxLoanBalance);

      // Check morpho balances
      const { collateralBalance: morphoCollateralBalanceFinal, loanBalance: morphoLoanBalanceFinal } =
        await getMorphoMarketPosition(client, WETH_USDC_MARKET_ID);

      expect(morphoCollateralBalanceFinal).toEqual(collateralMigrationAmount);
      expect(morphoLoanBalanceFinal).toEqual(loanMigrationAmount + BigInt(1));

      // Make sure bundler3 and adapters have been swept
      await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], WETH_ADDRESS);
      await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], USDC_ADDRESS);
    });
  });

  describe.concurrent("unhealthy position migration", () => {
    test.concurrent("should fail to migrate if leaving unhealthy aave position", async ({ client }) => {
      const wethCollateralAmount = parseEther("1");
      const usdcLoanAmount = parseUnits("100", 6);

      // Arrange
      await dealAndSupplyToAaveV3(client, WETH_ADDRESS, wethCollateralAmount, true);
      await borrowFromAaveV3(client, USDC_ADDRESS, usdcLoanAmount);

      // Act
      const action = await prepareAaveV3MarketMigrationAction({
        publicClient: client,
        accountAddress: client.account.address,
        marketId: WETH_USDC_MARKET_ID,
        collateralTokenAmount: maxUint256,
        loanTokenAmount: BigInt(1),
        allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
      });
      await expect(executeAction(client, action)).rejects.toThrow("tx failed");
    });
    test.concurrent("should fail to migrate if creating unhealthy morpho position", async ({ client }) => {
      const wethCollateralAmount = parseEther("1");
      const usdcLoanAmount = parseUnits("100", 6);

      // Arrange
      await dealAndSupplyToAaveV3(client, WETH_ADDRESS, wethCollateralAmount, true);
      await borrowFromAaveV3(client, USDC_ADDRESS, usdcLoanAmount);

      // Act
      const action = await prepareAaveV3MarketMigrationAction({
        publicClient: client,
        accountAddress: client.account.address,
        marketId: WETH_USDC_MARKET_ID,
        collateralTokenAmount: BigInt(1),
        loanTokenAmount: maxUint256,
        allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
      });
      // Will fail in simulation since we fully simulate Morpho side
      expect(action.status).toBe("error");
    });
  });

  describe.concurrent("input validation", () => {
    test.concurrent("should fail to migrate if loan token amount is 0", async ({ client }) => {
      const wethCollateralAmount = parseEther("1");
      const usdcLoanAmount = parseUnits("100", 6);
      const collateralMigrationAmount = wethCollateralAmount / BigInt(2);

      // Arrange
      await dealAndSupplyToAaveV3(client, WETH_ADDRESS, wethCollateralAmount, true);
      await borrowFromAaveV3(client, USDC_ADDRESS, usdcLoanAmount);

      // Act
      const action = await prepareAaveV3MarketMigrationAction({
        publicClient: client,
        accountAddress: client.account.address,
        marketId: WETH_USDC_MARKET_ID,
        collateralTokenAmount: collateralMigrationAmount,
        loanTokenAmount: BigInt(0),
        allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
      });
      expect(action.status).toBe("error");
    });
    test.concurrent("should fail to migrate if collateral token amount is 0", async ({ client }) => {
      const wethCollateralAmount = parseEther("1");
      const usdcLoanAmount = parseUnits("100", 6);

      // Arrange
      await dealAndSupplyToAaveV3(client, WETH_ADDRESS, wethCollateralAmount, true);
      await borrowFromAaveV3(client, USDC_ADDRESS, usdcLoanAmount);

      // Act
      const action = await prepareAaveV3MarketMigrationAction({
        publicClient: client,
        accountAddress: client.account.address,
        marketId: WETH_USDC_MARKET_ID,
        collateralTokenAmount: BigInt(0),
        loanTokenAmount: usdcLoanAmount,
        allocatingVaultAddresses: ALLOCATING_VAULT_ADDRESS,
      });
      expect(action.status).toBe("error"); // Would fail anyways in sim since no Morpho collateral
    });
  });
});
