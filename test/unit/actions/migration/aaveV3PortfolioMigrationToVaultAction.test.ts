// import { AnvilTestClient } from "@morpho-org/test";
// import { Address, parseEther, parseUnits } from "viem";
// import { describe, expect } from "vitest";

import { describe, test } from "vitest";

// import { aaveV3PortfolioMigrationToVaultAction } from "@/actions/migration/aaveV3PortfolioMigrationToVaultAction";
// import { USDC_ADDRESS } from "@/config";
// import { BUNDLER3_ADDRESS, SUPPORTED_ADDAPTERS } from "@/utils/constants";

// import { test } from "../../../config";
// import { dealAndSupplyToAaveV3 } from "../../../helpers/aaveV3";
// import { borrowFromAaveV3 } from "../../../helpers/aaveV3";
// import {
//   DAI_ADDRESS,
//   USDC_VAULT_ADDRESS,
//   USDT_ADDRESS,
//   WETH_ADDRESS,
//   WPOL_VAULT_ADDRESS,
// } from "../../../helpers/constants";
// import { expectZeroErc20Balances } from "../../../helpers/erc20";
// import { executeAction } from "../../../helpers/executeAction";
// import { expectOnlyAllowedApprovals } from "../../../helpers/logs";
// import { getMorphoVaultPosition } from "../../../helpers/morpho";
// import { paraswapSnapshotTest } from "../../snapshots/paraswapSnapshotTest";

// interface RunAaveV3PortfolioMigrationToVaultActionTestParameters {
//   client: AnvilTestClient;

//   portfolioPercentage: number;
//   maxSlippageTolerance: number;
//   vaultAddress: Address;

//   // Must be correctly collateralized
//   initialPositions: { assetAddress: Address; supplyAmount: bigint; borrowAmount: bigint }[];

//   minVaultPosition: bigint; // In vault asset
// }

// async function runAaveV3PortfolioMigrationToVaultActionTest({
//   client,

//   portfolioPercentage,
//   maxSlippageTolerance,
//   vaultAddress,

//   initialPositions,
//   minVaultPosition,
// }: RunAaveV3PortfolioMigrationToVaultActionTestParameters) {
//   // Arrange
//   const collateralPositions = initialPositions.filter((p) => p.supplyAmount > 0n);
//   const borrowPositions = initialPositions.filter((p) => p.borrowAmount > 0n);

//   for (const p of collateralPositions) {
//     await dealAndSupplyToAaveV3(client, p.assetAddress, p.supplyAmount, true);
//   }
//   for (const p of borrowPositions) {
//     await borrowFromAaveV3(client, p.assetAddress, p.borrowAmount);
//   }

//   // Act
//   const action = await aaveV3PortfolioMigrationToVaultAction({
//     publicClient: client,
//     accountAddress: client.account.address,

//     portfolioPercentage,
//     maxSlippageTolerance,

//     vaultAddress,
//   });
//   const logs = await executeAction(client, action);

//   // Assert
//   await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected

//   // Make sure no dust left anywhere
//   for (const p of initialPositions) {
//     await expectZeroErc20Balances(client, [BUNDLER3_ADDRESS, ...SUPPORTED_ADDAPTERS], p.assetAddress);
//   }

//   const positionBalance = await getMorphoVaultPosition(client, vaultAddress);
//   expect(positionBalance).toBeGreaterThanOrEqual(minVaultPosition);
// }

// const initialPositions = [
//   { assetAddress: USDC_ADDRESS, supplyAmount: parseUnits("1000", 6), borrowAmount: parseUnits("10", 6) },
//   { assetAddress: USDT_ADDRESS, supplyAmount: parseUnits("2000", 6), borrowAmount: parseUnits("500", 6) },
//   { assetAddress: WETH_ADDRESS, supplyAmount: parseEther("1"), borrowAmount: parseEther("0") },
//   { assetAddress: DAI_ADDRESS, supplyAmount: parseUnits("0", 18), borrowAmount: parseUnits("2000", 18) },
// ];

// describe("aaveV3PortfolioMigrationToVaultAction", () => {
//   describe("happy path", () => {
//     paraswapSnapshotTest("partial migration, USDC vault", async ({ client }) => {
//       await runAaveV3PortfolioMigrationToVaultActionTest({
//         client,

//         portfolioPercentage: 0.5,
//         maxSlippageTolerance: 0.015,
//         vaultAddress: USDC_VAULT_ADDRESS,

//         initialPositions,
//         minVaultPosition: parseUnits("1387", 6), // Need to update if taking a new snapshot to reflect ETH price
//       });
//     });
//     // paraswapSnapshotTest("full migration, USDC vault", async ({ client }) => {
//     //   await runAaveV3PortfolioMigrationToVaultActionTest({
//     //     client,

//     //     portfolioPercentage: 1,
//     //     maxSlippageTolerance: 0.015,
//     //     vaultAddress: USDC_VAULT_ADDRESS,

//     //     initialPositions,
//     //     minVaultPosition: parseUnits("2775", 6), // Need to update if taking a new snapshot to reflect ETH price
//     //   });
//     // });
//     paraswapSnapshotTest("partial migration, WPOL vault", async ({ client }) => {
//       await runAaveV3PortfolioMigrationToVaultActionTest({
//         client,

//         portfolioPercentage: 0.5,
//         maxSlippageTolerance: 0.015,
//         vaultAddress: WPOL_VAULT_ADDRESS,

//         initialPositions,
//         minVaultPosition: parseUnits("5280", 18), // Need to update if taking a new snapshot to reflect ETH price
//       });
//     });
//     // paraswapSnapshotTest("full migration, WPOL vault", async ({ client }) => {
//     //   await runAaveV3PortfolioMigrationToVaultActionTest({
//     //     client,

//     //     portfolioPercentage: 1,
//     //     maxSlippageTolerance: 0.015,
//     //     vaultAddress: WPOL_VAULT_ADDRESS,

//     //     initialPositions,
//     //     minVaultPosition: parseUnits("10673", 18), // Need to update if taking a new snapshot to reflect ETH price
//     //   });
//     // });
//   });

//   describe("sad path", () => {
//     test("portfolio percentage is 0", async ({ client }) => {
//       const action = await aaveV3PortfolioMigrationToVaultAction({
//         publicClient: client,
//         accountAddress: client.account.address,

//         portfolioPercentage: 0,
//         maxSlippageTolerance: 0.015,

//         vaultAddress: WPOL_VAULT_ADDRESS,
//       });
//       expect(action.status).toEqual("error");

//       if (action.status == "error") {
//         expect(action.message).toEqual(
//           "Simulation Error: Portfolio percentage must be between 0 (exclusive) and 1 (inclusive)"
//         );
//       }
//     });
//     test("portfolio percentage is >1", async ({ client }) => {
//       const action = await aaveV3PortfolioMigrationToVaultAction({
//         publicClient: client,
//         accountAddress: client.account.address,

//         portfolioPercentage: 1.1,
//         maxSlippageTolerance: 0.015,

//         vaultAddress: WPOL_VAULT_ADDRESS,
//       });
//       expect(action.status).toEqual("error");

//       if (action.status == "error") {
//         expect(action.message).toEqual(
//           "Simulation Error: Portfolio percentage must be between 0 (exclusive) and 1 (inclusive)"
//         );
//       }
//     });
//     test("slippage is 0", async ({ client }) => {
//       const action = await aaveV3PortfolioMigrationToVaultAction({
//         publicClient: client,
//         accountAddress: client.account.address,

//         portfolioPercentage: 0.5,
//         maxSlippageTolerance: 0.0,

//         vaultAddress: WPOL_VAULT_ADDRESS,
//       });
//       expect(action.status).toEqual("error");

//       if (action.status == "error") {
//         expect(action.message).toEqual("Simulation Error: Max slippage tolerance must be between 0 and 0.5");
//       }
//     });
//     test("slippage is >0.5", async ({ client }) => {
//       const action = await aaveV3PortfolioMigrationToVaultAction({
//         publicClient: client,
//         accountAddress: client.account.address,

//         portfolioPercentage: 0.5,
//         maxSlippageTolerance: 0.51,

//         vaultAddress: WPOL_VAULT_ADDRESS,
//       });
//       expect(action.status).toEqual("error");

//       if (action.status == "error") {
//         expect(action.message).toEqual("Simulation Error: Max slippage tolerance must be between 0 and 0.5");
//       }
//     });
//   });
// });

describe("aaveV3PortfolioMigrationToVaultAction", () => {
  test("unused", () => {
    // Unused: satifies vitest
  });
});
