import { describe, expect } from "vitest";
import { test } from "../../setup";
import { Address, maxUint256, parseUnits, zeroAddress } from "viem";
import { prepareVaultSupplyBundle } from "@/actions/prepareVaultSupplyAction";
import { executeAction } from "../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../helpers/logs";
import { expectZeroErc20Balances, getErc20BalanceOf } from "../../helpers/erc20";
import { BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";
import { AnvilTestClient } from "@morpho-org/test";
import { fetchVaultConfig, metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { dealAndSupplyToMorphoMarket, getMorphoVaultPosition } from "../../helpers/morpho";
import { TEST_ACCOUNT_1, USDC_ADDRESS, USDC_VAULT_ADDRESS, WETH_USDC_MARKET_ID } from "../../helpers/constants";
import { readContract } from "viem/actions";

interface VaultSupplyTestParameters {
  client: AnvilTestClient;
  vaultAddress: Address;
  supplyAmount: bigint;
  dealAmount?: bigint;
  beforeExecutionCb?: (client: AnvilTestClient) => Promise<void>;
  callerType?: "eoa" | "contract";
}

async function runVaultSupplyTest({
  client,
  vaultAddress,
  supplyAmount,
  dealAmount = supplyAmount,
  beforeExecutionCb,
  callerType = "eoa",
}: VaultSupplyTestParameters) {
  // Arrange
  const vaultConfig = await fetchVaultConfig(vaultAddress, client);
  const assetAddress = vaultConfig.asset;
  await client.deal({ erc20: assetAddress, amount: dealAmount });

  if (callerType === "contract") {
    await client.setCode({ address: client.account.address, bytecode: "0x60006000fd" });
  }

  // Act
  const action = await prepareVaultSupplyBundle({
    publicClient: client,
    accountAddress: client.account.address,
    vaultAddress,
    supplyAmount,
  });
  await beforeExecutionCb?.(client);
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(logs, client.account.address); // Make sure doesn't approve or permit anything unexpected
  await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS], assetAddress); // Make sure no funds left in bundler or used adapters

  const positionBalance = await getMorphoVaultPosition(client, vaultAddress);
  const walletBalance = await getErc20BalanceOf(client, USDC_ADDRESS, client.account.address);

  // Vault always rounds against the user, hence the 1 margin
  if (supplyAmount === maxUint256) {
    // Supply max when uint256
    expect(positionBalance).toBeWithinRange(dealAmount - BigInt(1), dealAmount);
    expect(walletBalance).toEqual(BigInt(0));
  } else {
    expect(positionBalance).toBeWithinRange(supplyAmount - BigInt(1), supplyAmount);
    expect(walletBalance).toEqual(dealAmount - supplyAmount);
  }
}

const successTestCases: ({ name: string } & Omit<VaultSupplyTestParameters, "client">)[] = [
  {
    name: "should increace position by supply amount",
    vaultAddress: USDC_VAULT_ADDRESS,
    supplyAmount: parseUnits("100000", 6),
    dealAmount: parseUnits("200000", 6),
  },
  {
    name: "should supply entire account balance when supply amount is max uint256",
    vaultAddress: USDC_VAULT_ADDRESS,
    supplyAmount: maxUint256,
    dealAmount: parseUnits("100000", 6),
    beforeExecutionCb: async (client) => {
      // Even if we wait some time for extra interest accural
      await client.mine({ blocks: 1000 });
    },
  },
];

describe("prepareVaultSupplyAction", () => {
  describe("happy path", () => {
    successTestCases.map((testCase) => {
      test.concurrent(testCase.name + " - eoa caller", async ({ client }) => {
        await runVaultSupplyTest({
          client,
          ...testCase,
          callerType: "eoa",
        });
      });
    });

    successTestCases.map((testCase) => {
      test.concurrent(testCase.name + " - contract caller", async ({ client }) => {
        await runVaultSupplyTest({
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
        runVaultSupplyTest({ client, vaultAddress: zeroAddress, supplyAmount: parseUnits("100000", 6) })
      ).rejects.toThrow();
    });

    test.concurrent("prepare error when supply amount is 0", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await prepareVaultSupplyBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        supplyAmount: BigInt(0),
      });
      expect(action.status).toBe("error");
    });

    test.concurrent("prepare error when supply amount exceeds user balance", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;
      const action = await prepareVaultSupplyBundle({
        publicClient: client,
        accountAddress: client.account.address,
        vaultAddress,
        supplyAmount: BigInt(10),
      });
      expect(action.status).toBe("error");
    });

    test.concurrent("tx should revert if slippage tolerance is exceeded", async ({ client }) => {
      const vaultAddress = USDC_VAULT_ADDRESS;

      const totalAssetsBefore = await readContract(client, {
        address: vaultAddress,
        abi: metaMorphoAbi,
        functionName: "totalAssets",
      });

      // Increase the share price by 0.05%, which should be above the acceptable slippage tolerance
      const donationAmount = (totalAssetsBefore * BigInt(0.0005 * 100000)) / BigInt(100000);

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
              TEST_ACCOUNT_1
            );
          },
        })
      ).rejects.toThrow("action-tx-reverted");
    });
  });
});
