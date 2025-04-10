import { GetSimuationStateMarketSupplyBorrowParameters, getSimulationState } from "@/data/getSimulationState";
import { addresses, DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { prepareBundle, PrepareMorphoActionReturnType, SimulatedValueChange } from "./helpers";
import { CHAIN_ID } from "@/config";
import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";
import { maxUint256 } from "viem";
import { getIsSmartAccount } from "@/data/getIsSmartAccount";

const { morpho } = addresses[CHAIN_ID];

type PrepareMarketSupplyCollateralBorrowActionParameters = Omit<
  GetSimuationStateMarketSupplyBorrowParameters,
  "actionType"
> & {
  supplyCollateralAmount: bigint; // Max uint256 for entire account collateral balance
  borrowAmount: bigint; // Don't support max here since we will only allow origination below a marging from LLTV
};

export type PrepareMarketSupplyCollateralBorrowActionReturnType =
  | (Omit<
      Extract<PrepareMorphoActionReturnType, { status: "success" }>,
      "initialSimulationState" | "finalSimulationState"
    > & {
      positionCollateralChange: SimulatedValueChange<bigint>;
      positionLoanChange: SimulatedValueChange<bigint>;
      positionLtvChange: SimulatedValueChange<bigint>;
    })
  | Extract<PrepareMorphoActionReturnType, { status: "error" }>;

export async function prepareMarketSupplyCollateralBorrowAction({
  supplyCollateralAmount,
  borrowAmount,
  accountAddress,
  marketId,
  publicClient,
  ...params
}: PrepareMarketSupplyCollateralBorrowActionParameters): Promise<PrepareMarketSupplyCollateralBorrowActionReturnType> {
  const [simulationState, isSmartAccount] = await Promise.all([
    getSimulationState({
      actionType: "market-supply-collateral-borrow",
      accountAddress,
      marketId,
      publicClient,
      ...params,
    }),
    getIsSmartAccount(publicClient, accountAddress),
  ]);

  const market = simulationState.markets?.[marketId];
  const userCollateralBalance =
    simulationState.holdings?.[accountAddress]?.[market?.params.collateralToken ?? "0x"]?.balance;
  if (supplyCollateralAmount == maxUint256) {
    if (!userCollateralBalance) {
      // Won't happen, we need this to have a correct simulation anyways
      return {
        status: "error",
        message: "Pre simulation error: Missing user asset balance for max collateral supply.",
      };
    }
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
              address: morpho,
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
              address: morpho,
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
    const positionBefore = preparedAction.initialSimulationState?.positions?.[accountAddress]?.[marketId];
    const positionAfter = preparedAction.finalSimulationState?.positions?.[accountAddress]?.[marketId];
    const marketBefore = preparedAction.initialSimulationState?.markets?.[marketId];
    const marketAfter = preparedAction.finalSimulationState?.markets?.[marketId];

    const positionCollateralBefore = positionBefore?.collateral ?? BigInt(0);
    const positionCollateralAfter = positionAfter?.collateral ?? BigInt(0);

    const positionLoanBefore = marketBefore?.toBorrowAssets(positionBefore?.borrowShares ?? BigInt(0)) ?? BigInt(0);
    const positionLoanAfter = marketAfter?.toBorrowAssets(positionAfter?.borrowShares ?? BigInt(0)) ?? BigInt(0);

    const ltvBefore =
      positionBefore?.borrowShares == BigInt(0)
        ? BigInt(0)
        : (marketBefore?.getLtv({
            collateral: positionCollateralBefore,
            borrowShares: positionBefore?.borrowShares ?? BigInt(0),
          }) ?? BigInt(0));
    const ltvAfter =
      positionAfter?.borrowShares == BigInt(0)
        ? BigInt(0)
        : (marketAfter?.getLtv({
            collateral: positionCollateralAfter,
            borrowShares: positionAfter?.borrowShares ?? BigInt(0),
          }) ?? BigInt(0));

    return {
      ...preparedAction,
      positionCollateralChange: {
        before: positionCollateralBefore,
        after: positionCollateralAfter,
      },
      positionLoanChange: {
        before: positionLoanBefore,
        after: positionLoanAfter,
      },
      positionLtvChange: {
        before: ltvBefore,
        after: ltvAfter,
      },
    };
  } else {
    return preparedAction;
  }
}
