import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId } from "@morpho-org/blue-sdk";
import { BundlerAction } from "@morpho-org/bundler-sdk-viem";
import { SimulationState, handleOperation, produceImmutable } from "@morpho-org/simulation-sdk";
import { Address, Client, maxUint256 } from "viem";

import { CHAIN_ID, USDC_ADDRESS } from "@/config";
import { GENERAL_ADAPTER_1_ADDRESS, MORPHO_BLUE_ADDRESS } from "@/utils/constants";

import { getIsContract } from "../data/rpc/getIsContract";
import { getMarketSimulationStateAccountingForPublicReallocation } from "../data/rpc/getSimulationState";
import { aaveV3PortfolioWindDownSubbundle } from "../subbundles/aaveV3PortfolioWindDownSubbundle";
import { subbundleFromInputOps } from "../subbundles/subbundleFromInputOps";
import { createBundle } from "../utils/bundlerActions";
import { MarketPositionChange, computeMarketPositionChange } from "../utils/positionChange";
import { Action } from "../utils/types";

// Always use USDC for now, could determine most liquid then use that in future to support larger migrations
const FLASH_LOAN_ASSET_ADDRESS = USDC_ADDRESS;

interface AaveV3PortfolioMigrationToMarketActionParameters {
  publicClient: Client;
  accountAddress: Address;

  portfolioPercentage: number; // (0, 1]
  maxSlippageTolerance: number; // (0,MAX_SLIPPAGE_TOLERANCE_LIMIT)

  marketId: MarketId;
  allocatingVaultAddresses: Address[];
  borrowAmount: bigint;
}

export type AaveV3PortfolioMigrationToMarketAction =
  | (Extract<Action, { status: "success" }> & { summary: MarketPositionChange })
  | Extract<Action, { status: "error" }>;

export async function aaveV3PortfolioMigrationToMarketAction({
  publicClient,
  accountAddress,

  portfolioPercentage,
  maxSlippageTolerance,

  marketId,
  allocatingVaultAddresses,
  borrowAmount,
}: AaveV3PortfolioMigrationToMarketActionParameters): Promise<AaveV3PortfolioMigrationToMarketAction> {
  // Note: Wind down subbundle does input validation on portfolioPercentage and maxTotalSlippageTolerance
  const [initialSimulationState, accountIsContract] = await Promise.all([
    getMarketSimulationStateAccountingForPublicReallocation({
      marketId: marketId,
      accountAddress,
      publicClient,
      allocatingVaultAddresses,
      requestedBorrowAmount: borrowAmount,
    }),
    getIsContract(publicClient, accountAddress),
  ]);

  const market = initialSimulationState.getMarket(marketId as MarketId);

  try {
    const windDownSubbundle = await aaveV3PortfolioWindDownSubbundle({
      publicClient,
      accountAddress,
      portfolioPercentage,
      maxSlippageTolerance,
      flashLoanAssetAddress: FLASH_LOAN_ASSET_ADDRESS,
      outputAssetAddress: market.params.collateralToken,
    });

    const intermediateSimulationState = produceImmutable(initialSimulationState, (draft) => {
      // Update simulation state to reflect the min output asset balance in GA1 from wind down
      draft.getHolding(GENERAL_ADAPTER_1_ADDRESS, market.params.collateralToken).balance +=
        windDownSubbundle.quotedOutputAssets;

      // Simulate the supply collateral
      // Note: prefer to put in the subbundle below, but there is a bug in the Morpho SDK with maxUint256 (being fixed)
      handleOperation(
        {
          type: "Blue_SupplyCollateral",
          sender: GENERAL_ADAPTER_1_ADDRESS,
          args: {
            id: marketId,
            onBehalf: accountAddress,
            assets: maxUint256,
          },
        },
        draft
      );
    });

    const borrowSubBundle = subbundleFromInputOps({
      inputOps: [
        {
          type: "Blue_Borrow",
          sender: accountAddress,
          address: MORPHO_BLUE_ADDRESS,
          args: {
            id: marketId,
            onBehalf: accountAddress,
            receiver: accountAddress,
            assets: borrowAmount,
            slippage: DEFAULT_SLIPPAGE_TOLERANCE,
          },
        },
      ],
      accountAddress,
      accountSupportsSignatures: !accountIsContract,
      simulationState: intermediateSimulationState as SimulationState,
    });

    function getBundleTx() {
      const bundlerCalls = [
        ...windDownSubbundle.bundlerCalls(),
        BundlerAction.morphoSupplyCollateral(CHAIN_ID, market.params, maxUint256, accountAddress, []),
        ...borrowSubBundle.bundlerCalls(),
      ].flat();

      return createBundle(bundlerCalls);
    }

    return {
      status: "success",
      signatureRequests: [...windDownSubbundle.signatureRequirements, ...borrowSubBundle.signatureRequirements],
      transactionRequests: [
        ...windDownSubbundle.transactionRequirements,
        ...borrowSubBundle.transactionRequirements,
        {
          name: "Confirm Migration",
          tx: getBundleTx,
        },
      ],
      summary: computeMarketPositionChange(
        marketId,
        accountAddress,
        initialSimulationState,
        borrowSubBundle.finalSimulationState
      ),
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
