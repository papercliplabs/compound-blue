import { DEFAULT_SLIPPAGE_TOLERANCE, MathLib } from "@morpho-org/blue-sdk";
import { BundlerAction } from "@morpho-org/bundler-sdk-viem";
import { handleOperation, produceImmutable } from "@morpho-org/simulation-sdk";
import { Address, Client, maxUint256 } from "viem";

import { CHAIN_ID, USDC_ADDRESS } from "@/config";
import { GENERAL_ADAPTER_1_ADDRESS } from "@/utils/constants";

import { getSimulationState } from "../data/rpc/getSimulationState";
import { aaveV3PortfolioWindDownSubbundle } from "../subbundles/aaveV3PortfolioWindDownSubbundle";
import { createBundle } from "../utils/bundlerActions";
import { VaultPositionChange, computeVaultPositionChange } from "../utils/positionChange";
import { Action } from "../utils/types";

// Hard code for now, could determine most liquid then use that in future to support larger migrations
const FLASH_LOAN_ASSET_ADDRESS = USDC_ADDRESS;

interface AaveV3PortfolioMigrationToVaultActionParameters {
  publicClient: Client;
  accountAddress: Address;

  portfolioPercentage: number; // (0, 1]
  maxSlippageTolerance: number; // (0,MAX_SLIPPAGE_TOLERANCE_LIMIT)

  vaultAddress: Address;
}

export type AaveV3PortfolioMigrationToVaultAction =
  | (Extract<Action, { status: "success" }> & {
      quotedChange: VaultPositionChange;
      worstCaseChange: VaultPositionChange;
    })
  | Extract<Action, { status: "error" }>;

export async function aaveV3PortfolioMigrationToVaultAction({
  publicClient,
  accountAddress,

  portfolioPercentage,
  maxSlippageTolerance,

  vaultAddress,
}: AaveV3PortfolioMigrationToVaultActionParameters): Promise<AaveV3PortfolioMigrationToVaultAction> {
  // Note: Wind down subbundle does input validation on portfolioPercentage and maxTotalSlippageTolerance
  const initialSimulationState = await getSimulationState({
    actionType: "vault",
    accountAddress,
    vaultAddress,
    publicClient,
  });

  const vault = initialSimulationState.getVault(vaultAddress);

  try {
    const windDownSubbundle = await aaveV3PortfolioWindDownSubbundle({
      publicClient,
      accountAddress,
      portfolioPercentage,
      maxSlippageTolerance,
      flashLoanAssetAddress: FLASH_LOAN_ASSET_ADDRESS,
      outputAssetAddress: vault.asset,
    });

    const quotedSimulationState = produceImmutable(initialSimulationState, (draft) => {
      // Update simulation state to reflect the min output asset balance in GA1 from wind down
      draft.getHolding(GENERAL_ADAPTER_1_ADDRESS, vault.asset).balance += windDownSubbundle.quotedOutputAssets;

      // Simulate the deposit
      handleOperation(
        {
          type: "MetaMorpho_Deposit",
          sender: GENERAL_ADAPTER_1_ADDRESS,
          address: vaultAddress,
          args: {
            assets: maxUint256, // Handles maxUint256
            owner: accountAddress,
          },
        },
        draft
      );
    });

    // Simulate to ensure the worst case will be successful also
    const worstCaseSimulationState = produceImmutable(initialSimulationState, (draft) => {
      // Update simulation state to reflect the min output asset balance in GA1 from wind down
      draft.getHolding(GENERAL_ADAPTER_1_ADDRESS, vault.asset).balance += windDownSubbundle.minOutputAssets;

      // Simulate the deposit
      handleOperation(
        {
          type: "MetaMorpho_Deposit",
          sender: GENERAL_ADAPTER_1_ADDRESS,
          address: vaultAddress,
          args: {
            assets: maxUint256, // Handles maxUint256
            owner: accountAddress,
          },
        },
        draft
      );
    });

    const maxSharePriceE27 = MathLib.mulDivUp(
      windDownSubbundle.quotedOutputAssets,
      MathLib.wToRay(MathLib.WAD + DEFAULT_SLIPPAGE_TOLERANCE),
      vault.toShares(windDownSubbundle.quotedOutputAssets)
    );

    const bundlerCalls = [
      ...windDownSubbundle.bundlerCalls(),
      BundlerAction.erc4626Deposit(CHAIN_ID, vault.address, maxUint256, maxSharePriceE27, accountAddress),
    ].flat();

    return {
      status: "success",
      signatureRequests: windDownSubbundle.signatureRequirements,
      transactionRequests: [
        ...windDownSubbundle.transactionRequirements,
        {
          name: "Confirm Migration",
          tx: () => createBundle(bundlerCalls),
        },
      ],
      quotedChange: computeVaultPositionChange(
        vaultAddress,
        accountAddress,
        initialSimulationState,
        quotedSimulationState
      ),
      worstCaseChange: computeVaultPositionChange(
        vaultAddress,
        accountAddress,
        initialSimulationState,
        worstCaseSimulationState
      ),
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}

// Note: Would prefer to use subbundleFromInputOps instead of handle operation, and manually adding erc4626 deposit (ex. see vaultSupplyAction)
// But, there is currently a bug in the Morpho SDK with maxUint256
// const vaultSupplySubbundle = subbundleFromInputOps({
//   inputOps: [
//     {
//       type: "MetaMorpho_Deposit",
//       sender: GENERAL_ADAPTER_1_ADDRESS,
//       address: vaultAddress,
//       args: {
//         assets: maxUint256, // Entire balance of GA1
//         owner: accountAddress,
//         slippage: DEFAULT_SLIPPAGE_TOLERANCE,
//       },
//     },
//   ],
//   accountAddress,
//   accountSupportsSignatures: !accountIsContract,
//   simulationState,
//   throwIfRequirements: true,
// });
// return subbundlesToAction(
//   [windDownSubbundle, vaultSupplySubbundle],
//   "Confirm Migration"
// )
