import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId } from "@morpho-org/blue-sdk";
import {
  computeMarketPositionChange,
  getMarketSimulationStateAccountingForPublicReallocation,
  MarketPositionChange,
  prepareBundle,
  PrepareMorphoActionReturnType,
} from "./helpers";
import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";
import { Address, Client, maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";
import { MORPHO_BLUE_ADDRESS } from "@/utils/constants";

interface PrepareMarketSupplyCollateralBorrowActionParameters {
  publicClient: Client;
  marketId: MarketId;
  allocatingVaultAddresses: Address[];
  accountAddress: Address;
  supplyCollateralAmount: bigint; // Max uint256 for entire account collateral balance
  borrowAmount: bigint; // Don't support max here since we will only allow origination below a marging from LLTV
}

export type PrepareMarketSupplyCollateralBorrowActionReturnType =
  | (Omit<
      Extract<PrepareMorphoActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > &
      MarketPositionChange)
  | Extract<PrepareMorphoActionReturnType, { status: "error" }>;

export async function prepareMarketSupplyCollateralBorrowAction({
  publicClient,
  marketId,
  allocatingVaultAddresses,
  accountAddress,
  supplyCollateralAmount,
  borrowAmount,
}: PrepareMarketSupplyCollateralBorrowActionParameters): Promise<PrepareMarketSupplyCollateralBorrowActionReturnType> {
  const [simulationState, isSmartAccount] = await Promise.all([
    getMarketSimulationStateAccountingForPublicReallocation({
      marketId,
      accountAddress,
      publicClient,
      allocatingVaultAddresses,
      requestedBorrowAmount: borrowAmount,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const market = simulationState.getMarket(marketId);
  const userCollateralBalance = simulationState.getHolding(accountAddress, market.params.collateralToken).balance;

  if (supplyCollateralAmount == maxUint256) {
    supplyCollateralAmount = userCollateralBalance;
  }

  const isSupply = supplyCollateralAmount > BigInt(0);
  const isBorrow = borrowAmount > BigInt(0);

  const preparedAction = prepareBundle(
    [
      ...(isSupply
        ? [
            {
              type: "Blue_SupplyCollateral",
              sender: accountAddress,
              address: MORPHO_BLUE_ADDRESS,
              args: {
                id: marketId,
                onBehalf: accountAddress,
                assets: supplyCollateralAmount,
              },
            } as InputBundlerOperation,
          ]
        : []),
      ...(isBorrow
        ? [
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
            } as InputBundlerOperation,
          ]
        : []),
    ],
    accountAddress,
    isSmartAccount,
    simulationState,
    `Confirm ${isSupply ? "Supply" : ""}${isSupply && isBorrow ? " & " : ""}${isBorrow ? "Borrow" : ""}`
  );

  if (preparedAction.status == "success") {
    const positionChange = computeMarketPositionChange(
      marketId,
      accountAddress,
      preparedAction.initialSimulationState,
      preparedAction.finalSimulationState
    );

    return {
      ...preparedAction,
      ...positionChange,
    };
  } else {
    return preparedAction;
  }
}
