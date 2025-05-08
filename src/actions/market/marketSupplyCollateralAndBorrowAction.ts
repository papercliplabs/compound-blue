import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId } from "@morpho-org/blue-sdk";
import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";
import { Address, Client, maxUint256 } from "viem";

import { getIsContract } from "@/actions/data/rpc/getIsContract";
import { MORPHO_BLUE_ADDRESS } from "@/utils/constants";

import { getMarketSimulationStateAccountingForPublicReallocation } from "../data/rpc/getSimulationState";
import { MarketPositionChange, computeMarketPositionChange } from "../utils/positionChange";
import { MorphoAction, prepareBundle } from "../utils/prepareBundle";

interface MarketSupplyCollateralAndBorrowActionParameters {
  publicClient: Client;
  marketId: MarketId;
  allocatingVaultAddresses: Address[];
  accountAddress: Address;
  collateralAmount: bigint; // Max uint256 for entire account collateral balance
  borrowAmount: bigint; // Don't support max here since we will only allow origination below a marging from LLTV
}

export type MarketSupplyCollateralAndBorrowAction =
  | (Omit<Extract<MorphoAction, { status: "success" }>, "initialSimulationState" | "finalSimulationState"> &
      MarketPositionChange)
  | Extract<MorphoAction, { status: "error" }>;

export async function marketSupplyCollateralAndBorrowAction({
  publicClient,
  marketId,
  allocatingVaultAddresses,
  accountAddress,
  collateralAmount,
  borrowAmount,
}: MarketSupplyCollateralAndBorrowActionParameters): Promise<MarketSupplyCollateralAndBorrowAction> {
  if (collateralAmount < 0n || borrowAmount < 0n) {
    return {
      status: "error",
      message: "Collateral and borrow amounts cannot be negative",
    };
  }
  if (collateralAmount == 0n && borrowAmount == 0n) {
    return {
      status: "error",
      message: "Collateral and borrow amounts cannot both be 0",
    };
  }

  const [simulationState, isContract] = await Promise.all([
    getMarketSimulationStateAccountingForPublicReallocation({
      marketId,
      accountAddress,
      publicClient,
      allocatingVaultAddresses,
      requestedBorrowAmount: borrowAmount,
    }),
    getIsContract(publicClient, accountAddress),
  ]);

  const market = simulationState.getMarket(marketId);
  const userCollateralBalance = simulationState.getHolding(accountAddress, market.params.collateralToken).balance;

  const isMaxSupplyCollateral = collateralAmount == maxUint256;

  const isSupply = collateralAmount > 0n;
  const isBorrow = borrowAmount > 0n;

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
                assets: isMaxSupplyCollateral ? userCollateralBalance : collateralAmount,
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
    isContract,
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
