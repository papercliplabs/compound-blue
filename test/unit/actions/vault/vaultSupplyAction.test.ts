import { MathLib } from "@morpho-org/blue-sdk";
import { fetchVaultConfig, metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, erc20Abi, isAddressEqual, maxUint256, parseEther, parseUnits, zeroAddress } from "viem";
import { getBalance, readContract } from "viem/actions";
import { describe, expect } from "vitest";

import { vaultSupplyBundle } from "@/actions/vault/vaultSupplyAction";
import { bigIntMax } from "@/utils/bigint";
import {
  BUNDLER3_ADDRESS,
  GENERAL_ADAPTER_1_ADDRESS,
  SUPPORTED_ADDAPTERS,
  WRAPPED_NATIVE_ADDRESS,
} from "@/utils/constants";

import { test } from "../../../config";
import {
  RANDOM_ADDRESS,
  USDC_ADDRESS,
  USDC_VAULT_ADDRESS,
  WETH_USDC_MARKET_ID,
  WPOL_VAULT_ADDRESS,
} from "../../../helpers/constants";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
import { dealAndSupplyToMorphoMarket, getMorphoVaultPosition } from "../../../helpers/morpho";

interface VaultSupplyTestParameters {
  client: AnvilTestClient;
  vaultAddress: Address;
  supplyAmount: bigint;
  dealAmount?: bigint;
  initialNativeBalance?: bigint;
  allowWrappingNativeAssets?: boolean;
  beforeExecutionCb?: (client: AnvilTestClient) => Promise<void>;
  callerType?: "eoa" | "contract";
}

async function runVaultSupplyTest({
  client,
  vaultAddress,
  supplyAmount,
  dealAmount = supplyAmount,
  initialNativeBalance = parseEther("1000"),
  allowWrappingNativeAssets = false,
  beforeExecutionCb,
  callerType = "eoa",
}: VaultSupplyTestParameters) {
  // Arrange
  const vaultConfig = await fetchVaultConfig(vaultAddress, client);
  const assetAddress = vaultConfig.asset;
  await client.deal({ erc20: assetAddress, amount: dealAmount });
  await client.setBalance({ address: client.account.address, value: initialNativeBalance });

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  // Act
  const action = await vaultSupplyBundle({
    publicClient: client,
    accountAddress: client.account.address,
    vaultAddress,
    supplyAmount,
    allowWrappingNativeAssets,
  });
  await beforeExecutionCb?.(client);

  const nativeBalanceBeforeExecution = await getBalance(client, { address: client.account.address });
  const erc20BalanceBeforeExecution = await getErc20BalanceOf(client, assetAddress, client.account.address);

  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], assetAddress); // Make sure no funds left in bundler or used adapters

  const positionAfterExecution = await getMorphoVaultPosition(client, vaultAddress);
  const walletErc20Balance = await getErc20BalanceOf(client, USDC_ADDRESS, client.account.address);
  const walletNativeBalance = await getBalance(client, { address: client.account.address });

  const isWrappedNative = isAddressEqual(assetAddress, WRAPPED_NATIVE_ADDRESS);
  const expectWrappingNative = isWrappedNative && allowWrappingNativeAssets;

  // Vault always rounds against the user, hence the 1 margin
  const coveredByNative = expectWrappingNative ? bigIntMax(supplyAmount - dealAmount, 0n) : 0n;

  const expectedPositionBalance = supplyAmount;
  expect(positionAfterExecution.userAssetBalance).toBeWithinRange(
    expectedPositionBalance - BigInt(1),
    expectedPositionBalance
  );

  expect(walletErc20Balance).toEqual(bigIntMax(erc20BalanceBeforeExecution - supplyAmount, 0n));
  expect(walletNativeBalance).toEqual(nativeBalanceBeforeExecution - coveredByNative);
}

const successTestCases: ({ name: string } & Omit<VaultSupplyTestParameters, "client">)[] = [
  {
    name: "should increace position by supply amount",
    vaultAddress: USDC_VAULT_ADDRESS,
    supplyAmount: parseUnits("100000", 6),
    dealAmount: parseUnits("200000", 6),
  },
  {
    name: "should supply entire account balance when supply amount is exactly balance",
    vaultAddress: USDC_VAULT_ADDRESS,
    supplyAmount: parseUnits("100000", 6),
    dealAmount: parseUnits("100000", 6),
    beforeExecutionCb: async (client) => {
      // Even if we wait some time for extra interest accural
      await client.mine({ blocks: 1000 });
    },
  },
  {
    name: "allowWrapingNativeAssets shouldn't impact non wrapped native vaults",
    vaultAddress: USDC_VAULT_ADDRESS,
    supplyAmount: parseUnits("100000", 6),
    dealAmount: parseUnits("200000", 6),
    allowWrappingNativeAssets: true,
  },
  {
    name: "should wrap native assets when required and enabled",
    vaultAddress: WPOL_VAULT_ADDRESS,
    supplyAmount: parseUnits("150000", 6),
    dealAmount: parseUnits("100000", 6),
    allowWrappingNativeAssets: true,
  },
  {
    name: "should wrap native assets only",
    vaultAddress: WPOL_VAULT_ADDRESS,
    supplyAmount: parseUnits("150000", 6),
    dealAmount: parseUnits("0", 6),
    allowWrappingNativeAssets: true,
  },
  {
    name: "should increase position by supply amount only (partial), and lead to no leftover in bundler/ga1 even if there is an increase in approval + balance before execution",
    vaultAddress: USDC_VAULT_ADDRESS,
    supplyAmount: parseUnits("100000", 6),
    dealAmount: parseUnits("200000", 6),
    beforeExecutionCb: async (client) => {
      await client.deal({ erc20: USDC_ADDRESS, amount: parseUnits("10000000", 6) });
      await client.writeContract({
        abi: erc20Abi,
        address: USDC_ADDRESS,
        functionName: "approve",
        args: [GENERAL_ADAPTER_1_ADDRESS, maxUint256],
      });
    },
  },
  {
    name: "should increase position by supply amount only (full), and lead to no leftover in bundler/ga1 even if there is an increase in approval + balance before execution",
    vaultAddress: USDC_VAULT_ADDRESS,
    supplyAmount: parseUnits("200000", 6),
    dealAmount: parseUnits("200000", 6),
    beforeExecutionCb: async (client) => {
      await client.deal({ erc20: USDC_ADDRESS, amount: parseUnits("10000000", 6) });
      await client.writeContract({
        abi: erc20Abi,
        address: USDC_ADDRESS,
        functionName: "approve",
        args: [GENERAL_ADAPTER_1_ADDRESS, maxUint256],
      });
    },
  },
];

describe("vaultSupplyAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      test(testCase.name + " - eoa caller", async ({ client }) => {
        await runVaultSupplyTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      test(testCase.name + " - contract caller", async ({ client }) => {
        await runVaultSupplyTest({
          client,
          ...testCase,
          callerType: "contract",
        });
      });
    });
  });

  describe("sad path", () => {
    test("throws error when vault doens't exist", async ({ client }) => {
      await expect(
        runVaultSupplyTest({ client, vaultAddress: zeroAddress, supplyAmount: parseUnits("100000", 6) })
      ).rejects.toThrow();
    });

    test("prepare error when supply amount is 0", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await vaultSupplyBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        supplyAmount: BigInt(0),
        allowWrappingNativeAssets: false,
      });
      expect(action.status).toBe("error");
    });

    test("prepare error when supply amount exceeds user balance", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await vaultSupplyBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        supplyAmount: BigInt(10),
        allowWrappingNativeAssets: false,
      });
      expect(action.status).toBe("error");
    });

    test("tx should revert if slippage tolerance is exceeded", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;

      const totalAssetsBefore = await readContract(client, {
        address: vaultAddress,
        abi: metaMorphoAbi,
        functionName: "totalAssets",
      });

      // Increase the share price by 0.05%, which should be above the acceptable slippage tolerance
      const donationAmount = MathLib.mulDivUp(totalAssetsBefore, BigInt(0.0005 * Number(MathLib.WAD)), MathLib.WAD);

      await client.setBalance({ address: RANDOM_ADDRESS, value: parseEther("10") });
      await expect(
        runVaultSupplyTest({
          client,
          vaultAddress,
          supplyAmount: parseUnits("100000", 6),
          beforeExecutionCb: async () => {
            // Large supply to a market on behalf of vault to manipulate (increacing) the share price (totalAssets / totalShares)
            // Note that vaults totalAssets is the sum over it's assets in each of the allocating markets
            // So, one way to manipulate the share price is a large "donation" to a market on behalf of the vault
            await dealAndSupplyToMorphoMarket(
              client,
              WETH_USDC_MARKET_ID,
              donationAmount,
              USDC_VAULT_ADDRESS,
              RANDOM_ADDRESS
            );
          },
        })
      ).rejects.toThrow("action-tx-reverted");
    });

    test("throws when amount equals max uint256", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await vaultSupplyBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        supplyAmount: maxUint256,
        allowWrappingNativeAssets: false,
      });
      expect(action.status).toBe("error");

      if (action.status === "error") {
        expect(action.message).toBe("Supply amount cannot be greater than or equal to max uint256");
      }
    });

    test("throws when amount greater than max uint256", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await vaultSupplyBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        supplyAmount: maxUint256 + 1n,
        allowWrappingNativeAssets: false,
      });
      expect(action.status).toBe("error");

      if (action.status === "error") {
        expect(action.message).toBe("Supply amount cannot be greater than or equal to max uint256");
      }
    });
  });
});
