export function computeAaveEffectiveBorrowApy(
  supplyAmountUsd: number,
  supplyApy: number,
  borrowAmountUsd: number,
  borrowApy: number
) {
  return (borrowAmountUsd * borrowApy - supplyAmountUsd * supplyApy) / (supplyAmountUsd + borrowAmountUsd);
}

export function computeAaveNewLltv(
  oldTotalCollateralUsd: number,
  oldLltv: number,
  collateralUsdDelta: number,
  collateralReserveLltv: number
): number | undefined {
  const newTotalCollateralUsd = Math.max(oldTotalCollateralUsd + collateralUsdDelta, 0);
  const oldLiquidationBorrowThresholdUsd = oldLltv * oldTotalCollateralUsd;
  const newLiquidationBorrowThresholdUsd =
    oldLiquidationBorrowThresholdUsd + collateralUsdDelta * collateralReserveLltv;

  return newTotalCollateralUsd > 0
    ? Math.max(Math.min(newLiquidationBorrowThresholdUsd / newTotalCollateralUsd, 1), 0)
    : undefined;
}
