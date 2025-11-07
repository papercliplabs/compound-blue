import { fetchVaultConfig } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, erc20Abi, maxUint256, parseUnits, zeroAddress } from "viem";
import { describe, expect } from "vitest";

import { vaultWithdrawAction } from "@/actions/vault/vaultWithdrawAction";
import { BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";

import { test } from "../../../config";
import { USDC_ADDRESS, USDC_VAULT_ADDRESS } from "../../../helpers/constants";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
import {
  dealAndSupplyToMorphoVault,
  getMorphoVaultPosition,
  getMorphoVaultSharesToAssets,
} from "../../../helpers/morpho";

interface VaultWithdrawTestParameters {
  client: AnvilTestClient;
  vaultAddress: Address;
  withdrawAmount: bigint;
  accountAddress?: Address;
  initialSupplyAmount: bigint;
  beforeExecutionCb?: (client: AnvilTestClient) => Promise<void>;
  callerType?: "eoa" | "contract";
}

async function runVaultWithdrawTest({
  client,
  vaultAddress,
  withdrawAmount,
  initialSupplyAmount,
  beforeExecutionCb,
  callerType = "eoa",
}: VaultWithdrawTestParameters) {
  // Arrange
  const vaultConfig = await fetchVaultConfig(vaultAddress, client);
  const assetAddress = vaultConfig.asset;
  await dealAndSupplyToMorphoVault(client, vaultAddress, initialSupplyAmount);

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  const positionBalanceBeforeBuild = await getMorphoVaultPosition(client, vaultAddress);

  // Act
  const action = await vaultWithdrawAction({
    publicClient: client,
    accountAddress: client.account.address,
    vaultAddress,
    withdrawAmount,
  });

  await beforeExecutionCb?.(client);

  const erc20BalanceBeforeExecution = await getErc20BalanceOf(client, assetAddress, client.account.address);
  const positionBalanceBeforeExecution = await getMorphoVaultPosition(client, vaultAddress);

  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS], assetAddress); // Make sure no funds left in bundler or used adapters

  const positionBalanceAfterExecution = await getMorphoVaultPosition(client, vaultAddress);
  const walletBalanceAfterExecution = await getErc20BalanceOf(client, USDC_ADDRESS, client.account.address);

  // When we requested a max withdraw, the withdraw amount is expected to be for the asset value of the shares the user had upon building action
  const expectedWithdrawAmount =
    withdrawAmount === maxUint256
      ? await getMorphoVaultSharesToAssets(
          client,
          vaultAddress,
          client.account.address,
          positionBalanceBeforeBuild.userShareBalance
        )
      : withdrawAmount;

  const expectedPositionBalance = positionBalanceBeforeExecution.userAssetBalance - expectedWithdrawAmount;
  expect(positionBalanceAfterExecution.userAssetBalance).toBeGreaterThanOrEqual(expectedPositionBalance - 1n);

  const expectedWalletBalance = erc20BalanceBeforeExecution + expectedWithdrawAmount;
  expect(walletBalanceAfterExecution).toBeGreaterThanOrEqual(expectedWalletBalance - 1n);
}

const successTestCases: ({ name: string } & Omit<VaultWithdrawTestParameters, "client" | "callerType">)[] = [
  {
    name: "should decrease position by withdraw amount",
    vaultAddress: USDC_VAULT_ADDRESS,
    initialSupplyAmount: parseUnits("10000000", 6),
    withdrawAmount: parseUnits("100000", 6),
  },
  {
    name: "should withdraw entire position for max uint256 withdraw amount",
    vaultAddress: USDC_VAULT_ADDRESS,
    initialSupplyAmount: parseUnits("123456", 6),
    withdrawAmount: maxUint256,
    beforeExecutionCb: async (client) => {
      // Even if we wait some time for extra interest accural
      await client.mine({ blocks: 1000 });
    },
  },
  {
    name: "should decrease position by withdraw amount even if increase in approval + share balance before execution",
    vaultAddress: USDC_VAULT_ADDRESS,
    initialSupplyAmount: parseUnits("10000000", 6),
    withdrawAmount: parseUnits("100000", 6),
    beforeExecutionCb: async (client) => {
      await dealAndSupplyToMorphoVault(client, USDC_VAULT_ADDRESS, parseUnits("10000000000", 6));
      await client.writeContract({
        abi: erc20Abi,
        address: USDC_VAULT_ADDRESS,
        functionName: "approve",
        args: [GENERAL_ADAPTER_1_ADDRESS, maxUint256],
      });
    },
  },
  {
    name: "should withdraw entire initial position for max uint256 withdraw amount even if increase in approval + share balance before execution",
    vaultAddress: USDC_VAULT_ADDRESS,
    initialSupplyAmount: parseUnits("123456", 6),
    withdrawAmount: maxUint256,
    beforeExecutionCb: async (client) => {
      await dealAndSupplyToMorphoVault(client, USDC_VAULT_ADDRESS, parseUnits("10000000000", 6));
      await client.writeContract({
        abi: erc20Abi,
        address: USDC_VAULT_ADDRESS,
        functionName: "approve",
        args: [GENERAL_ADAPTER_1_ADDRESS, maxUint256],
      });
    },
  },
];

describe("vaultWithdrawAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      test(testCase.name + " - eoa caller", async ({ client }) => {
        await runVaultWithdrawTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      test(testCase.name + " - contract caller", async ({ client }) => {
        await runVaultWithdrawTest({
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
        runVaultWithdrawTest({
          client,
          vaultAddress: zeroAddress,
          withdrawAmount: parseUnits("1000", 6),
          initialSupplyAmount: parseUnits("100000", 6),
        })
      ).rejects.toThrow();
    });

    test("prepare error when withdraw amount is 0", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await vaultWithdrawAction({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        withdrawAmount: BigInt(0),
      });
      expect(action.status).toBe("error");
    });

    test("prepare error when withdraw amount exceeds user balance", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await vaultWithdrawAction({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        withdrawAmount: BigInt(10),
      });
      expect(action.status).toBe("error");
    });

    // It's not possible to deflate the share price in metamorpho v1.1 since it doesn't realize market losses.
    // Tried to override storage slot for lastTotalAssets to force a loss realization, but causes other issues since this is used elsewhere in the contract.
    // test("tx should revert if slippage tolerance is exceeded", async ({ client }) => {
    // });
  });
});
