import { describe, expect } from "vitest";
import { test } from "../../setup";
import { Address, maxUint256, parseUnits } from "viem";
import { dealAndSupplyToAaveV3, getAaveV3SupplyBalance } from "../../helpers/aaveV3";
import { USDC_ADDRESS } from "../../helpers/constants";
import { prepareAaveV3VaultMigrationAction } from "@/actions/prepareAaveV3VaultMigrationAction";
import { executeAction } from "../../helpers/actions";
import { getMorphoVaultAccountBalance } from "../../helpers/morpho";
import { AnvilTestClient } from "@morpho-org/test";
import { expectZeroErc20Balances } from "../../helpers/erc20";
import { addresses } from "@morpho-org/blue-sdk";
import { CHAIN_ID } from "@/config";

const USDC_VAULT_ADDRESS = "0x781FB7F6d845E3bE129289833b04d43Aa8558c42";

const REBASEING_MARGIN = BigInt(100030);
const REBASEING_MARGIN_SCALE = BigInt(100000);

const {
  bundler3: { bundler3, aaveV3CoreMigrationAdapter, generalAdapter1 },
} = addresses[CHAIN_ID];

interface RunVaultMigrationTestParameters {
  client: AnvilTestClient;
  vaultAddress: Address;
  assetAddress: Address;
  aaveSupplyAmount: bigint;
  migrationAmount: bigint; // maxUint256 for full migration
  delayBlocks: number; // delay between action preparation and execution
  checks: {
    aaveV3SupplyBalanceFinalLimits: {
      min: bigint;
      max: bigint;
    };
    vaultPositionBalanceFinalLimits: {
      min: bigint;
      max: bigint;
    };
  };
}

async function runVaultMigrationTest({
  client,
  vaultAddress,
  assetAddress,
  aaveSupplyAmount,
  migrationAmount, // maxUint256 for full migration
  delayBlocks, // delay between action preparation and execution
  checks,
}: RunVaultMigrationTestParameters) {
  // Arrange
  await dealAndSupplyToAaveV3(client, assetAddress, aaveSupplyAmount, true);

  // Act
  const action = await prepareAaveV3VaultMigrationAction({
    publicClient: client,
    accountAddress: client.account.address,
    vaultAddress,
    amount: migrationAmount,
  });
  await client.mine({ blocks: delayBlocks });
  await executeAction(client, action);

  // Assert
  // Check aave v3 balances
  const aaveV3SupplyBalanceFinal = await getAaveV3SupplyBalance(client, assetAddress);
  expect(aaveV3SupplyBalanceFinal).toBeWithinRange(
    checks.aaveV3SupplyBalanceFinalLimits.min,
    checks.aaveV3SupplyBalanceFinalLimits.max
  );

  // Check morpho balances
  const morphoBalanceFinal = await getMorphoVaultAccountBalance(client, vaultAddress);
  expect(morphoBalanceFinal).toBeWithinRange(
    checks.vaultPositionBalanceFinalLimits.min,
    checks.vaultPositionBalanceFinalLimits.max
  );

  // Check no leftover balances
  await expectZeroErc20Balances(client, [bundler3, aaveV3CoreMigrationAdapter!, generalAdapter1], assetAddress);
}

describe("prepareAaveV3VaultMigrationAction", () => {
  test.concurrent("should migrate full position", async ({ client }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const aaveV3SupplyBalanceFinalLimits = { min: BigInt(0), max: BigInt(0) };
    const vaultPositionBalanceFinalLimits = {
      min: aaveSupplyAmount,
      max: (aaveSupplyAmount * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE,
    };
    await runVaultMigrationTest({
      client,
      vaultAddress: USDC_VAULT_ADDRESS,
      assetAddress: USDC_ADDRESS,
      aaveSupplyAmount,
      migrationAmount: maxUint256,
      delayBlocks: 0,
      checks: {
        aaveV3SupplyBalanceFinalLimits,
        vaultPositionBalanceFinalLimits,
      },
    });
  });

  test.concurrent("should migrate full position with <1 day delay", async ({ client }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const aaveV3SupplyBalanceFinalLimits = { min: BigInt(0), max: BigInt(0) };
    const vaultPositionBalanceFinalLimits = {
      min: aaveSupplyAmount,
      max: (aaveSupplyAmount * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE,
    };
    await runVaultMigrationTest({
      client,
      vaultAddress: USDC_VAULT_ADDRESS,
      assetAddress: USDC_ADDRESS,
      aaveSupplyAmount,
      migrationAmount: maxUint256,
      delayBlocks: 1000,
      checks: {
        aaveV3SupplyBalanceFinalLimits,
        vaultPositionBalanceFinalLimits,
      },
    });
  });

  test.concurrent(
    "should fail when migrating full position with long delay between creation and execution (rebasing casues failure)",
    async ({ client }) => {
      const aaveSupplyAmount = parseUnits("1000000", 6);
      const aaveV3SupplyBalanceFinalLimits = { min: BigInt(0), max: BigInt(0) };
      const vaultPositionBalanceFinalLimits = {
        min: aaveSupplyAmount,
        max: (aaveSupplyAmount * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE,
      };
      await expect(
        runVaultMigrationTest({
          client,
          vaultAddress: USDC_VAULT_ADDRESS,
          assetAddress: USDC_ADDRESS,
          aaveSupplyAmount,
          migrationAmount: maxUint256,
          delayBlocks: 500000,
          checks: {
            aaveV3SupplyBalanceFinalLimits,
            vaultPositionBalanceFinalLimits,
          },
        })
      ).rejects.toThrow("tx failed");
    }
  );

  test.concurrent("should migrate partial position", async ({ client }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const migrationAmount = aaveSupplyAmount / BigInt(4);
    const aaveV3SupplyBalanceFinalLimits = {
      min: aaveSupplyAmount - migrationAmount,
      max: ((aaveSupplyAmount - migrationAmount) * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE,
    };
    const vaultPositionBalanceFinalLimits = {
      min: migrationAmount - BigInt(1), // From rounding
      max: (migrationAmount * REBASEING_MARGIN) / REBASEING_MARGIN_SCALE,
    };
    await runVaultMigrationTest({
      client,
      vaultAddress: USDC_VAULT_ADDRESS,
      assetAddress: USDC_ADDRESS,
      aaveSupplyAmount,
      migrationAmount,
      delayBlocks: 0,
      checks: {
        aaveV3SupplyBalanceFinalLimits,
        vaultPositionBalanceFinalLimits,
      },
    });
  });

  test.concurrent("should migrate partial position with long delay (uses exact amounts)", async ({ client }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const migrationAmount = aaveSupplyAmount / BigInt(4);
    const aaveV3SupplyBalanceFinalLimits = {
      min: aaveSupplyAmount - migrationAmount,
      max: maxUint256, // Could accure lots of interest, which is fine
    };
    const vaultPositionBalanceFinalLimits = {
      min: migrationAmount - BigInt(1), // From rounding
      max: migrationAmount,
    };
    await runVaultMigrationTest({
      client,
      vaultAddress: USDC_VAULT_ADDRESS,
      assetAddress: USDC_ADDRESS,
      aaveSupplyAmount,
      migrationAmount,
      delayBlocks: 500000,
      checks: {
        aaveV3SupplyBalanceFinalLimits,
        vaultPositionBalanceFinalLimits,
      },
    });
  });
});
