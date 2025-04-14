import { describe, expect } from "vitest";
import { test } from "../../setup";
import { Address, maxUint256, parseUnits, zeroAddress } from "viem";
import { executeAction } from "../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../helpers/logs";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../helpers/erc20";
import { BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";
import { AnvilTestClient } from "@morpho-org/test";
import { fetchVaultConfig } from "@morpho-org/blue-sdk-viem";
import { dealAndSupplyToMorphoVault, getMorphoVaultPosition } from "../../helpers/morpho";
import { USDC_ADDRESS, USDC_VAULT_ADDRESS } from "../../helpers/constants";
import { prepareVaultWithdrawBundle } from "@/actions/prepareVaultWithdrawAction";

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

  // Act
  const action = await prepareVaultWithdrawBundle({
    publicClient: client,
    accountAddress: client.account.address,
    vaultAddress,
    withdrawAmount,
  });
  await beforeExecutionCb?.(client);
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(logs, client.account.address); // Make sure doesn't approve or permit anything unexpected
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS], assetAddress); // Make sure no funds left in bundler or used adapters

  const positionBalance = await getMorphoVaultPosition(client, vaultAddress);
  const walletBalance = await getErc20BalanceOf(client, USDC_ADDRESS, client.account.address);

  // Vault always rounds against the user, hence the 1 margin
  if (withdrawAmount === maxUint256) {
    // Withdraw max when uint256
    expect(positionBalance).toEqual(BigInt(0));
    expect(walletBalance).toBeGreaterThanOrEqual(initialSupplyAmount);
  } else {
    expect(positionBalance).toBeGreaterThanOrEqual(initialSupplyAmount - withdrawAmount - BigInt(1));
    expect(walletBalance).toEqual(withdrawAmount);
  }
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
];

describe("prepareVaultWithdrawAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      test.concurrent(testCase.name + " - eoa caller", async ({ client }) => {
        await runVaultWithdrawTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      test.concurrent(testCase.name + " - contract caller", async ({ client }) => {
        await runVaultWithdrawTest({
          client,
          ...testCase,
          callerType: "contract",
        });
      });
    });
  });

  describe("sad path", () => {
    test.concurrent("throws error when vault doens't exist", async ({ client }) => {
      await expect(
        runVaultWithdrawTest({
          client,
          vaultAddress: zeroAddress,
          withdrawAmount: parseUnits("1000", 6),
          initialSupplyAmount: parseUnits("100000", 6),
        })
      ).rejects.toThrow();
    });

    test.concurrent("prepare error when withdraw amount is 0", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await prepareVaultWithdrawBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        withdrawAmount: BigInt(0),
      });
      expect(action.status).toBe("error");
    });

    test.concurrent("prepare error when withdraw amount exceeds user balance", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await prepareVaultWithdrawBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        withdrawAmount: BigInt(10),
      });
      expect(action.status).toBe("error");
    });

    // It's not possible to deflate the share price in metamorpho v1.1 since it doesn't realize market losses.
    // Tried to override storage slot for lastTotalAssets to force a loss realization, but causes other issues since this is used elsewhere in the contract.
    // test.concurrent("tx should revert if slippage tolerance is exceeded", async ({ client }) => {
    // });
  });
});
