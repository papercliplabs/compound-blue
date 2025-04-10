import { describe, expect } from "vitest";
import { test } from "../../setup";
import { prepareMarketLeveragedBorrowAction } from "@/actions/prepareMarketLeverageBorrowAction";
import { executeAction } from "../../helpers/actions";
import { addresses, MarketId } from "@morpho-org/blue-sdk";
import { Address, parseEther } from "viem";
import { AnvilTestClient } from "@morpho-org/test";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../helpers/erc20";
import { CHAIN_ID } from "@/config";
import { getSimulationState } from "@/data/getSimulationState";
import { getMorphoMarketAccountBalances } from "../../helpers/morpho";

const WETH_USDC_MARKET_ID = "0xa5b7ae7654d5041c28cb621ee93397394c7aee6c6e16c7e0fd030128d87ee1a3" as MarketId;

const {
  bundler3: {
    bundler3: bundler3Address,
    generalAdapter1: generalAdapter1Address,
    paraswapAdapter: paraswapAdapterAddress,
  },
} = addresses[CHAIN_ID];

interface RunMarketLeveragedBorrowTestParamters {
  client: AnvilTestClient;
  marketId: MarketId;
  initialCollateralAmount: bigint;
  leverageFactor: number;
  maxSlippageTolerance: number;
  requiresPublicReallocation: boolean;
  allocatingVaultAddresses: Address[];
  delayBlocks: number; // delay between action preparation and execution
  checks: {
    loanBalanceFinalLimits: {
      min: bigint;
      max: bigint;
    };
  };
}

async function runMarketLeveragedBorrowTest({
  client,
  marketId,
  initialCollateralAmount,
  leverageFactor,
  maxSlippageTolerance,
  delayBlocks,
  checks,
  ...rest
}: RunMarketLeveragedBorrowTestParamters) {
  // Arrange
  const simulationState = await getSimulationState({
    publicClient: client,
    accountAddress: client.account.address,
    actionType: "market-supply-collateral-borrow",
    marketId,
    allocatingVaultAddresses: [],
    requiresReallocation: false,
  });
  const { collateralToken: collateralAssetAddress, loanToken: loanAssetAddress } =
    simulationState.getMarket(marketId).params;

  client.deal({
    erc20: collateralAssetAddress,
    amount: initialCollateralAmount,
  });

  // Act
  const action = await prepareMarketLeveragedBorrowAction({
    publicClient: client,
    accountAddress: client.account.address,
    marketId,
    initialCollateralAmount,
    leverageFactor,
    maxSlippageTolerance,
    ...rest,
  });
  await client.mine({ blocks: delayBlocks });
  await executeAction(client, action);

  // Assert
  const [accountCollateralBalanceFinal, accountLoanBalanceFinal] = await Promise.all([
    getErc20BalanceOf(client, client.account.address, collateralAssetAddress),
    getErc20BalanceOf(client, client.account.address, collateralAssetAddress),
  ]);
  expect(accountCollateralBalanceFinal).toEqual(BigInt(0)); // Used all delt collateral
  expect(accountLoanBalanceFinal).toEqual(BigInt(0)); // Drew down no loan

  const { collateralBalance: morphoCollateralBalanceFinal, loanBalance: morphoLoanBalanceFinal } =
    await getMorphoMarketAccountBalances(client, marketId);
  expect(morphoCollateralBalanceFinal).toEqual(
    (initialCollateralAmount * BigInt(Math.floor(leverageFactor * 10000))) / BigInt(10000)
  );
  expect(morphoLoanBalanceFinal).toBeWithinRange(checks.loanBalanceFinalLimits.min, checks.loanBalanceFinalLimits.max);

  // Check no leftover balances
  await expectZeroErc20Balances(
    client,
    [bundler3Address, generalAdapter1Address!, paraswapAdapterAddress!],
    collateralAssetAddress
  );
  await expectZeroErc20Balances(
    client,
    [bundler3Address, generalAdapter1Address!, paraswapAdapterAddress!],
    loanAssetAddress
  );
}

describe("prepareMarketLeveragedBorrowAction", () => {
  test("todo", async ({ client }) => {
    await runMarketLeveragedBorrowTest({
      client,
      marketId: WETH_USDC_MARKET_ID, // WETH collateral for USDC loan
      initialCollateralAmount: parseEther("1"),
      leverageFactor: 2.1,
      maxSlippageTolerance: 0.05,
      requiresPublicReallocation: false,
      allocatingVaultAddresses: [],
      delayBlocks: 1,
      checks: {
        // TODO: actually set...
        loanBalanceFinalLimits: {
          min: parseEther("0"),
          max: BigInt(1e30),
        },
      },
    });
  });
});
