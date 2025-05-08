import { MarketId } from "@morpho-org/blue-sdk";
import { MaybeDraft, SimulationState } from "@morpho-org/simulation-sdk";
import { Address } from "viem";

export interface SimulatedValueChange<T> {
  before: T;
  after: T;
}

export type MarketPositionChange = {
  positionCollateralChange: SimulatedValueChange<bigint>;
  positionLoanChange: SimulatedValueChange<bigint>;
  positionLtvChange: SimulatedValueChange<bigint>;
};

export function computeMarketPositionChange(
  marketId: MarketId,
  accountAddress: Address,
  initialSimulationState: SimulationState | MaybeDraft<SimulationState>,
  finalSimulationState: SimulationState | MaybeDraft<SimulationState>
): MarketPositionChange {
  const positionBefore = initialSimulationState.getPosition(accountAddress, marketId);
  const positionAfter = finalSimulationState.getPosition(accountAddress, marketId);
  const marketBefore = initialSimulationState.getMarket(marketId);
  const marketAfter = finalSimulationState.getMarket(marketId);

  const ltvBefore = marketBefore.getLtv({
    collateral: positionBefore.collateral,
    borrowShares: positionBefore.borrowShares,
  });
  const ltvAfter = marketAfter.getLtv({
    collateral: positionAfter.collateral,
    borrowShares: positionAfter.borrowShares,
  });

  return {
    positionCollateralChange: {
      before: positionBefore.collateral,
      after: positionAfter.collateral,
    },
    positionLoanChange: {
      before: marketBefore.toBorrowAssets(positionBefore.borrowShares),
      after: marketAfter.toBorrowAssets(positionAfter.borrowShares),
    },
    positionLtvChange: {
      before: ltvBefore ?? BigInt(0),
      after: ltvAfter ?? BigInt(0),
    },
  };
}
