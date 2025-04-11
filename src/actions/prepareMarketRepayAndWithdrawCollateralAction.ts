import { getSimulationState } from "@/data/getSimulationState";
import { DEFAULT_SLIPPAGE_TOLERANCE, MarketId } from "@morpho-org/blue-sdk";
import {
  computeMarketPositionChange,
  MarketPositionChange,
  prepareBundle,
  PrepareMorphoActionReturnType,
} from "./helpers";
import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";
import { Address, Client, maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";
import { MORPHO_BLUE_ADDRESS } from "@/utils/constants";

interface PrepareMarketRepayAndWithdrawCollateralActionParameters {
  publicClient: Client;
  marketId: MarketId;
  accountAddress: Address;
  repayAmount: bigint; // Max uint256 for entire position balance
  withdrawCollateralAmount: bigint; // Max uint256 for entire position collateral balance
}

export type PrepareMarketRepayAndWithdrawCollateralActionReturnType =
  | (Omit<
      Extract<PrepareMorphoActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > &
      MarketPositionChange)
  | Extract<PrepareMorphoActionReturnType, { status: "error" }>;

export async function prepareMarketRepayAndWithdrawCollateralAction({
  publicClient,
  marketId,
  accountAddress,
  repayAmount,
  withdrawCollateralAmount,
}: PrepareMarketRepayAndWithdrawCollateralActionParameters): Promise<PrepareMarketRepayAndWithdrawCollateralActionReturnType> {
  if (repayAmount == BigInt(0) && withdrawCollateralAmount == BigInt(0)) {
    return {
      status: "error",
      message: "Repay and withdraw collateral amounts cannot both be 0",
    };
  }

  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "market",
      accountAddress,
      marketId,
      publicClient,
      requiresPublicReallocation: false,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const isMaxRepay = repayAmount == maxUint256;
  const isMaxWithdrawCollateral = withdrawCollateralAmount == maxUint256;

  const userPosition = simulationState.getPosition(accountAddress, marketId);
  if (isMaxWithdrawCollateral) {
    withdrawCollateralAmount = userPosition.collateral;
  }

  const isRepay = repayAmount > BigInt(0);
  const isWithdraw = withdrawCollateralAmount > BigInt(0);

  const preparedAction = prepareBundle(
    [
      ...(isRepay
        ? [
            {
              type: "Blue_Repay",
              sender: accountAddress,
              address: MORPHO_BLUE_ADDRESS,
              args: {
                id: marketId,
                onBehalf: accountAddress,
                // Use shares if a max repay to ensure fully closed position
                ...(isMaxRepay ? { shares: userPosition.borrowShares } : { assets: repayAmount }),
                slippage: DEFAULT_SLIPPAGE_TOLERANCE,
              },
            } as InputBundlerOperation,
          ]
        : []),
      ...(isWithdraw
        ? [
            {
              type: "Blue_WithdrawCollateral",
              sender: accountAddress,
              address: MORPHO_BLUE_ADDRESS,
              args: {
                id: marketId,
                onBehalf: accountAddress,
                receiver: accountAddress,
                assets: withdrawCollateralAmount,
              },
            } as InputBundlerOperation,
          ]
        : []),
    ],
    accountAddress,
    isSmartAccount,
    simulationState,
    `Confirm ${isRepay ? "Repay" : ""}${isRepay && isWithdraw ? " & " : ""}${isWithdraw ? "Withdraw" : ""}`
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
