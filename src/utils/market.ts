import { MarketUtils } from "@morpho-org/blue-sdk";
import { parseUnits } from "viem";

import { MAX_BORROW_LTV_MARGIN } from "@/config";
import { AccountMarketPosition } from "@/data/whisk/getAccountMarketPositions";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";

import { bigIntMax } from "./bigint";

export function computeMaxBorrowableAssets(
  market: MarketSummary,
  newCollateral: bigint,
  position?: AccountMarketPosition
): bigint {
  if (!position) {
    return 0n;
  }

  const totalCollateral = BigInt(position.collateralAssets) + newCollateral;
  const maxBorrow = MarketUtils.getMaxBorrowAssets(
    totalCollateral,
    { price: market.rawCollateralPriceInLoanAsset },
    { lltv: parseUnits((market.lltv - MAX_BORROW_LTV_MARGIN).toString(), 18) } // Scaled by WAD
  )!; // Won't be undefined since price is not undefined

  return bigIntMax(maxBorrow - BigInt(position.borrowAssets), 0n);
}
