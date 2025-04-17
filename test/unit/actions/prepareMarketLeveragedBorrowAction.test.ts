import { describe, expect, vi } from "vitest";
import { test } from "../../setup";
import { prepareMarketLeveragedBorrowAction } from "@/actions/prepareMarketLeverageBorrowAction";
import { MarketId, MathLib } from "@morpho-org/blue-sdk";
import { Address, maxUint256, parseEther } from "viem";
import { AnvilTestClient } from "@morpho-org/test";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../helpers/erc20";
import { getMorphoMarketPosition } from "../../helpers/morpho";
import { GetParaswapReturnType } from "@/data/paraswap/types";
import { fetchMarket } from "@morpho-org/blue-sdk-viem";
import { getParaswapExactBuy } from "@/data/paraswap/getParaswapExactBuy";
import { BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS, PARASWAP_ADAPTER_ADDRESS } from "@/utils/constants";
import { expectOnlyAllowedApprovals } from "../../helpers/logs";
import { WETH_USDC_MARKET_ALLOCATING_VAULT_ADDRESS, WETH_USDC_MARKET_ID } from "../../helpers/constants";
import { executeAction } from "../../helpers/executeAction";

vi.mock("@/data/paraswap/getParaswapExactBuy");

interface MarketLeveragedBorrowTestParameters {
  client: AnvilTestClient;
  marketId: MarketId;
  allocatingVaultAddresses: Address[];

  initialCollateralAmount: bigint;
  leverageFactor: number;
  maxSlippageTolerance: number;

  collateralDealAmount: bigint;

  beforeExecutionCb?: (client: AnvilTestClient) => Promise<void>;
  callerType?: "eoa" | "contract";
  blockNumber: bigint;
  mockParaswapQuote: GetParaswapReturnType;
}

async function runMarketLeveragedBorrowTest({
  client,
  marketId,

  allocatingVaultAddresses,
  initialCollateralAmount,
  leverageFactor,
  maxSlippageTolerance,

  collateralDealAmount = initialCollateralAmount,
  beforeExecutionCb,
  callerType,
  blockNumber,
  mockParaswapQuote,
}: MarketLeveragedBorrowTestParameters) {
  // Arrange
  const market = await fetchMarket(marketId, client);
  const { loanToken: loanTokenAddress, collateralToken: collateralTokenAddress } = market.params;

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  await client.reset({ blockNumber });

  client.deal({ erc20: collateralTokenAddress, amount: collateralDealAmount });

  vi.mocked(getParaswapExactBuy).mockReturnValue(new Promise((resolve) => resolve(mockParaswapQuote)));

  // Act
  const action = await prepareMarketLeveragedBorrowAction({
    publicClient: client,
    marketId,
    allocatingVaultAddresses,

    accountAddress: client.account.address,

    initialCollateralAmount,
    leverageFactor,
    maxSlippageTolerance,
  });
  await beforeExecutionCb?.(client);
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected
  await expectZeroErc20Balances(
    client,
    [BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS, PARASWAP_ADAPTER_ADDRESS!],
    collateralTokenAddress
  ); // Make sure no funds left in bundler or used adapters
  await expectZeroErc20Balances(
    client,
    [BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS, PARASWAP_ADAPTER_ADDRESS!],
    loanTokenAddress
  ); // Make sure no funds left in bundler or used adapters

  const { collateralBalance: positionCollateralBalance, loanBalance: positionLoanBalance } =
    await getMorphoMarketPosition(client, marketId, client.account.address);
  const walletCollateralBalance = await getErc20BalanceOf(client, collateralTokenAddress, client.account.address);

  const initialCollateralInternal =
    initialCollateralAmount == maxUint256 ? collateralDealAmount : initialCollateralAmount;

  const finalCollateralAmount = MathLib.mulDivUp(
    initialCollateralInternal,
    BigInt(leverageFactor * 10000),
    BigInt(10000)
  );

  expect(walletCollateralBalance).toBe(collateralDealAmount - initialCollateralInternal);
  expect(positionCollateralBalance).toBe(finalCollateralAmount);

  const borrowAmount = market.getCollateralValue(finalCollateralAmount - initialCollateralInternal)!;
  const maxBorrowAmount = MathLib.mulDivUp(borrowAmount, BigInt((1 + maxSlippageTolerance) * 100000), 100000n);

  expect(positionLoanBalance).toBeLessThanOrEqual(maxBorrowAmount);
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
    blockNumber: BigInt(70282333),
    mockParaswapQuote: {
      augustus: "0x6A000F20005980200259B80c5102003040001068",
      calldata:
        "0x7f457675000000000000000000000000a0f408a000017007015e0f00320e470d00090a5b0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000007ceb23fd6bc0add59e62ac25578270cff1b9f619000000000000000000000000000000000000000000000000000000006fa9d12e0000000000000000000000000000000000000000000000000f43fc2c04ee0000000000000000000000000000000000000000000000000000000000006a6cd31a7f101ab2c18643bfb2b773cbcfa8807a00000000000000000000000004306cbb0000000000000000000000000000000000000000000000000000000000000000cc3e7c85bb0ee4f09380e041fee95a0caedd4a029400000000000000000000000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000006200000040000000000000000000000018c000000000000016c00000000000024b8d315a9c38ec871068fec378e4ce78af528c7629303e0016403c50000000100030000000000000000000000000000000000000000000000000000000052bbbe2900000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000a0f408a000017007015e0f00320e470d00090a5b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000006a000f20005980200259b80c5102003040001068000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000067fcb86110386ac4e294773a94f26b32df836e193ec6724c00020000000000000000000800000000000000000000000000000000000000000000000000000000000000010000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c33590000000000000000000000007ceb23fd6bc0add59e62ac25578270cff1b9f6190000000000000000000000000000000000000000000000000e59818589c1000000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000180000000000000000000000000000000000000000000000000000632b51deb3b880000000000000000000000000000000000000000000000000000000067fcb86100000000000000000000000000000000000000000000000000000000000000e00000000000000000000000005f2617f12d1fdd1e43e72cb80c92dfce8124db8d00000000000000000000000000000000000000000000000000005af3107a40000000000000000057fe77fe2edff155c900000000000000000e7e3db264bb400000000000000004b375b3dea5e7d7800000000000000000007ff1709bcd328689000000000000000000000000000000000000000000010849557090f9ea33076e00000000000000004563918244f400000000000000000000006a94d74f43000000000000000000000000000067fcb8250000000000000000000058acfcdd98000000000000000000000000000000000000000000000000000000000000000041f80cced5b5720e779e707195d896a39eb83d9d4df66369e07c19e92fad00e1b8498a0a751f30b1d8e40f9f0d8536b0f83ba6453a12d5ad2bf7ae34f661cc9e7f1b0000000000000000000000000000000000000000000000000000000000000000000180000000000000000000000120000000000000014e0000000000000258e592427a0aece92de3edee1f18e0157c058615640160008400a400000000000300000000000000000000000000000000000000000000000000000000f28c0498000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000006a000f20005980200259b80c5102003040001068000000000000000000000000000000000000000000000000000000006805f2a500000000000000000000000000000000000000000000000000ea7aa67b2d00000000000000000000000000000000000000000000000000000000000006628c2000000000000000000000000000000000000000000000000000000000000000427ceb23fd6bc0add59e62ac25578270cff1b9f6190001f40d500b1d8e8ef31e21c99d1db9a6444d3adf12700001f43c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000000000000000000000000000000000000000",
      offsets: {
        exactAmount: BigInt(132n),
        limitAmount: BigInt(100n),
        quotedAmount: BigInt(164n),
      },
    },
  },
];

describe("prepareMarketLeveragedBorrowAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      test.concurrent(testCase.name + " - eoa caller", async ({ client }) => {
        await runMarketLeveragedBorrowTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      test.concurrent(testCase.name + " - contract caller", async ({ client }) => {
        await runMarketLeveragedBorrowTest({
          client,
          ...testCase,
          callerType: "contract",
        });
      });
    });
  });
});
