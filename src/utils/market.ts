import { MAX_BORROW_LTV_MARGIN } from "@/config";
import { AccountMarketPosition } from "@/data/whisk/getAccountMarketPositions";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";

import { descaleBigIntToNumber } from "./format";

export function computeNewBorrowMax(
  market: MarketSummary,
  newCollateral: number,
  position?: AccountMarketPosition
): number {
  if (!position) {
    return 0;
  }

  const currentCollateral = descaleBigIntToNumber(position.collateralAssets, market.collateralAsset.decimals);
  const currentLoan = descaleBigIntToNumber(position.borrowAssets, market.loanAsset.decimals);
  const newTotalCollateral = currentCollateral + newCollateral;
  const maxLoan = newTotalCollateral * market.collateralPriceInLoanAsset * (market.lltv - MAX_BORROW_LTV_MARGIN);

  return Math.max(maxLoan - currentLoan, 0);
}
