import { AnvilTestClient } from "@morpho-org/test";
import { Address, maxUint256, parseUnits } from "viem";
import { describe, expect } from "vitest";

import { computeAmountWithRebasingMargin } from "@/actions/helpers";
import { prepareAaveV3VaultMigrationAction } from "@/actions/prepareAaveV3VaultMigrationAction";
import { AAVE_V3_MIGRATION_ADAPTER_ADDRESS, BUNDLER3_ADDRESS, GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";

import { currentBlockTest as test } from "../../config";
import { dealAndSupplyToAaveV3, getAaveV3SupplyBalance } from "../../helpers/aaveV3";
import { USDC_ADDRESS } from "../../helpers/constants";
import { expectZeroErc20Balances } from "../../helpers/erc20";
import { executeAction } from "../../helpers/executeAction";
import { getMorphoVaultPosition } from "../../helpers/morpho";


const USDC_VAULT_ADDRESS = "0x781FB7F6d845E3bE129289833b04d43Aa8558c42";

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
  const morphoBalanceFinal = await getMorphoVaultPosition(client, vaultAddress);
  expect(morphoBalanceFinal).toBeWithinRange(
    checks.vaultPositionBalanceFinalLimits.min,
    checks.vaultPositionBalanceFinalLimits.max
  );

  // Check no leftover balances
  await expectZeroErc20Balances(
    client,
    [BUNDLER3_ADDRESS, AAVE_V3_MIGRATION_ADAPTER_ADDRESS!, GENERAL_ADAPTER_1_ADDRESS!],
    assetAddress
  );
}

describe("prepareAaveV3VaultMigrationAction", () => {
  test("should migrate full position", async ({ client }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const aaveV3SupplyBalanceFinalLimits = { min: BigInt(0), max: BigInt(0) };
    const vaultPositionBalanceFinalLimits = {
      min: aaveSupplyAmount,
      max: computeAmountWithRebasingMargin(aaveSupplyAmount),
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

  test("should migrate full position with <1 day delay", async ({ client }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const aaveV3SupplyBalanceFinalLimits = { min: BigInt(0), max: BigInt(0) };
    const vaultPositionBalanceFinalLimits = {
      min: aaveSupplyAmount,
      max: computeAmountWithRebasingMargin(aaveSupplyAmount),
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

  test("should fail when migrating full position with long delay between creation and execution (rebasing/slippage casues failure)", async ({
    client,
  }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const aaveV3SupplyBalanceFinalLimits = { min: BigInt(0), max: BigInt(0) };
    const vaultPositionBalanceFinalLimits = {
      min: aaveSupplyAmount,
      max: computeAmountWithRebasingMargin(aaveSupplyAmount),
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
    ).rejects.toThrow("action-tx-reverted");
  });

  test("should migrate partial position", async ({ client }) => {
    const aaveSupplyAmount = parseUnits("1000000", 6);
    const migrationAmount = aaveSupplyAmount / BigInt(4);
    const aaveV3SupplyBalanceFinalLimits = {
      min: aaveSupplyAmount - migrationAmount,
      max: computeAmountWithRebasingMargin(aaveSupplyAmount - migrationAmount),
    };
    const vaultPositionBalanceFinalLimits = {
      min: migrationAmount - BigInt(1), // From rounding
      max: computeAmountWithRebasingMargin(migrationAmount),
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
});
