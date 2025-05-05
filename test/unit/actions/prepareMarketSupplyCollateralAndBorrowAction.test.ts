import { prepareMarketSupplyCollateralAndBorrowAction } from "@/actions/prepareMarketSupplyCollateralAndBorrowAction";
import { MarketId } from "@morpho-org/blue-sdk";
import { blueAbi, fetchMarket } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, Hex, maxUint256, parseEther, parseUnits } from "viem";
import { executeAction } from "../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../helpers/logs";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../helpers/erc20";
import { BUNDLER3_ADDRESS, MORPHO_BLUE_ADDRESS, SUPPORTED_ADDAPTERS } from "@/utils/constants";
import { dealAndSupplyCollateralToMorphoMarket, getMorphoMarketPosition } from "../../helpers/morpho";
import { describe, expect } from "vitest";
import { WETH_ADDRESS, WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS, WETH_USDC_MARKET_ID } from "../../helpers/constants";
import { test } from "../../config";
import { bigIntMax } from "@/utils/bigint";
import { readContract } from "viem/actions";

interface MarketSupplyCollateralAndBorrowTestParameters {
  client: AnvilTestClient;

  marketId: MarketId;
  allocatingVaultAddresses: Address[];

  collateralAmount: bigint;
  borrowAmount: bigint;

  collateralDealAmount?: bigint;
  initialPositionCollateralBalance?: bigint;
  beforeExecutionCb?: (client: AnvilTestClient) => Promise<void>;
  callerType?: "eoa" | "contract";
}

async function runSupplyCollateralAndBorrowTest({
  client,
  marketId,
  allocatingVaultAddresses,
  collateralAmount,
  borrowAmount,
  collateralDealAmount = collateralAmount,
  beforeExecutionCb,
  initialPositionCollateralBalance = BigInt(0),
  callerType = "eoa",
}: MarketSupplyCollateralAndBorrowTestParameters) {
  // Arrange
  const market = await fetchMarket(marketId, client);
  const { loanToken: loanTokenAddrress, collateralToken: collateralTokenAddress } = market.params;
  await client.deal({ erc20: collateralTokenAddress, amount: collateralDealAmount });

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  if (initialPositionCollateralBalance != BigInt(0)) {
    await dealAndSupplyCollateralToMorphoMarket(client, marketId, initialPositionCollateralBalance);
  }

  // Act
  const action = await prepareMarketSupplyCollateralAndBorrowAction({
    publicClient: client,
    marketId,
    allocatingVaultAddresses,
    accountAddress: client.account.address,
    collateralAmount,
    borrowAmount,
  });
  await beforeExecutionCb?.(client);
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], collateralTokenAddress); // Make sure no funds left in bundler or used adapters
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], loanTokenAddrress); // Make sure no funds left in bundler or used adapters

  const { collateralBalance: positionCollateralBalance, loanBalance: positionLoanBalance } =
    await getMorphoMarketPosition(client, marketId, client.account.address);

  const walletCollateralBalance = await getErc20BalanceOf(client, collateralTokenAddress, client.account.address);
  const walletLoanBalance = await getErc20BalanceOf(client, loanTokenAddrress, client.account.address);

  if (collateralAmount === maxUint256) {
    expect(positionCollateralBalance).toBeWithinRange(
      bigIntMax(initialPositionCollateralBalance + collateralDealAmount - BigInt(1), BigInt(0)),
      initialPositionCollateralBalance + collateralDealAmount
    );
    expect(walletCollateralBalance).toEqual(BigInt(0));
  } else {
    expect(positionCollateralBalance).toBeWithinRange(
      bigIntMax(initialPositionCollateralBalance + collateralAmount - BigInt(1), BigInt(0)),
      initialPositionCollateralBalance + collateralAmount
    );
    expect(walletCollateralBalance).toEqual(collateralDealAmount - collateralAmount);
  }

  expect(positionLoanBalance).toBeWithinRange(borrowAmount, borrowAmount + BigInt(1));
  expect(walletLoanBalance).toBeWithinRange(borrowAmount, borrowAmount + BigInt(1));
}

const successTestCases: ({ name: string } & Omit<MarketSupplyCollateralAndBorrowTestParameters, "client">)[] = [
  {
    name: "partial supply collateral, no borrow",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
    collateralAmount: parseEther("100"), // WETH
    borrowAmount: parseUnits("0", 6), // USDC
    collateralDealAmount: parseEther("200"),
  },
  {
    name: "full supply collateral, no borrow",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
    collateralAmount: maxUint256,
    borrowAmount: parseUnits("0", 6), // USDC
    collateralDealAmount: parseEther("200"),
  },
  {
    name: "partial supply collatal and borrow",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
    collateralAmount: parseEther("100"),
    borrowAmount: parseUnits("100", 6), // USDC
    collateralDealAmount: parseEther("200"),
  },
  {
    name: "full supply collatal and borrow",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
    collateralAmount: maxUint256,
    borrowAmount: parseUnits("100", 6), // USDC
    collateralDealAmount: parseEther("200"),
  },
  {
    name: "borrow against previously supplied collateral",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
    collateralAmount: BigInt(0),
    borrowAmount: parseUnits("100", 6), // USDC
    initialPositionCollateralBalance: parseEther("100"),
  },
  {
    name: "borrow requiring public reallocation",
    marketId: WETH_USDC_MARKET_ID,
    allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
    collateralAmount: parseEther("1000000"),
    borrowAmount: parseUnits("110000", 6), // USDC
  },
];

describe("prepareMarketSupplyCollateralAndBorrowAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      test(testCase.name + " - eoa caller", async ({ client }) => {
        await runSupplyCollateralAndBorrowTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      test(testCase.name + " - contract caller", async ({ client }) => {
        await runSupplyCollateralAndBorrowTest({
          client,
          ...testCase,
          callerType: "contract",
        });
      });
    });
  });

  describe("sad path", () => {
    test("throws error when market doesn't exist", async ({ client }) => {
      await client.deal({ erc20: WETH_ADDRESS, amount: parseEther("100") });
      await expect(
        prepareMarketSupplyCollateralAndBorrowAction({
          publicClient: client,
          marketId: "0x0000000000000000000000000000000000000000000000000000000000000001" as MarketId,
          allocatingVaultAddresses: [],
          accountAddress: client.account.address,
          collateralAmount: parseEther("100"),
          borrowAmount: parseUnits("100", 6),
        })
      ).rejects.toThrow(); // Unknown, this is viem error
    });

    test("prepare error if collateral and borrow amount are both 0", async ({ client }) => {
      await client.deal({ erc20: WETH_ADDRESS, amount: parseEther("100") });
      const action = await prepareMarketSupplyCollateralAndBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        accountAddress: client.account.address,
        collateralAmount: BigInt(0),
        borrowAmount: BigInt(0),
      });
      expect(action.status).toBe("error");
    });

    test("prepare error if collateral exceeds wallet balance", async ({ client }) => {
      const action = await prepareMarketSupplyCollateralAndBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        accountAddress: client.account.address,
        collateralAmount: BigInt(10),
        borrowAmount: BigInt(0),
      });
      expect(action.status).toBe("error");
    });

    test("prepare error if loan is not sufficiently collateralized", async ({ client }) => {
      await client.deal({ erc20: WETH_ADDRESS, amount: parseEther("100") });
      const action = await prepareMarketSupplyCollateralAndBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        accountAddress: client.account.address,
        collateralAmount: BigInt(1),
        borrowAmount: parseUnits("10000", 6),
      });
      expect(action.status).toBe("error");
    });

    test("prepare error if borrow exceeds markets available liquidity", async ({ client }) => {
      await client.deal({ erc20: WETH_ADDRESS, amount: parseEther("10000000") });
      const action = await prepareMarketSupplyCollateralAndBorrowAction({
        publicClient: client,
        marketId: WETH_USDC_MARKET_ID,
        allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
        accountAddress: client.account.address,
        collateralAmount: parseEther("10000000"),
        borrowAmount: parseUnits("8000000", 6),
      });
      expect(action.status).toBe("error");
    });

    test("tx reverts if slippage tolerance is exceeded", async ({ client }) => {
      const marketId = WETH_USDC_MARKET_ID;

      await expect(
        runSupplyCollateralAndBorrowTest({
          client,
          marketId,
          allocatingVaultAddresses: WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS,
          collateralAmount: parseEther("100"),
          borrowAmount: parseUnits("100", 6),
          beforeExecutionCb: async () => {
            const [, , totalBorrowAssets] = await readContract(client, {
              address: MORPHO_BLUE_ADDRESS,
              abi: blueAbi,
              functionName: "market",
              args: [marketId],
            });

            // Induce 0.05% slippage
            const newTotalBorrowAssets =
              (totalBorrowAssets * BigInt(Math.floor((1 - 0.0005) * 100000))) / BigInt(100000);

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
