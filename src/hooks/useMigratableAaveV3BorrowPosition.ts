"use client";
import { AaveV3ReservePosition } from "@/data/whisk/getAaveV3MarketPosition";
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { isAddressEqual, getAddress } from "viem";
import { trackEvent } from "@/data/trackEvent";
import { useAaveV3MarketPosition } from "./useAaveV3MarketPosition";
import { AccountMarketPosition } from "@/data/whisk/getAccountMarketPositions";
import { useAccountMarketPositions } from "./useAccountMarketPosition";
import { MarketId } from "@morpho-org/blue-sdk";

export interface MigratableAaveV3BorrowPosition {
  aaveV3CollateralReservePosition: AaveV3ReservePosition;
  aaveV3LoanReservePosition: AaveV3ReservePosition;
  aaveFullPositionMetrics: {
    // Needed to derive the new LLTV
    totalBorrowUsd: number;
    totalCollateralUsd: number;
    liquidationBorrowThresholdUsd: number; // sum(col_i * lltv_i)
  };
  destinationMarketPosition: AccountMarketPosition;
}

export function useMigratableAaveV3BorrowPositions(): {
  data?: MigratableAaveV3BorrowPosition[];
  isLoading: boolean;
  error: Error | null;
} {
  const {
    data: aaveV3MarketPosition,
    isLoading: isAavePositionLoading,
    error: aaveV3MarketPositionError,
  } = useAaveV3MarketPosition();

  const {
    data: marketPositions,
    isLoading: isMarketPositionsLoading,
    error: marketPositionsError,
  } = useAccountMarketPositions();

  const migratableAaveV3BorrowPositions: MigratableAaveV3BorrowPosition[] | undefined = useMemo(() => {
    if (!aaveV3MarketPosition || !marketPositions) {
      return undefined;
    }

    const aaveV3CollateralReservePositions = aaveV3MarketPosition.reservePositions.filter(
      (r) => r.aTokenAssetsUsd > 0 && r.isUsageAsCollateralEnabled
    );

    const aaveV3LoanReservePositions = aaveV3MarketPosition.reservePositions.filter((r) => r.borrowAssetsUsd > 0);

    const totalBorrowUsd = aaveV3LoanReservePositions.reduce((acc, r) => acc + r.borrowAssetsUsd, 0);
    const totalCollateralUsd = aaveV3CollateralReservePositions.reduce((acc, r) => acc + r.aTokenAssetsUsd, 0);
    const liquidationBorrowThresholdUsd = aaveV3CollateralReservePositions.reduce(
      (acc, r) => acc + r.aTokenAssetsUsd * r.reserve.lltv,
      0
    );

    const migratableAaveV3BorrowPositions: MigratableAaveV3BorrowPosition[] = [];
    for (const destinationMarketPosition of Object.values(marketPositions)) {
      const market = destinationMarketPosition.market;
      if (market && market.collateralAsset) {
        const aaveV3CollateralReservePosition = aaveV3CollateralReservePositions.find((r) =>
          isAddressEqual(getAddress(r.reserve.underlyingAsset.address), getAddress(market.collateralAsset!.address))
        );
        const aaveV3LoanReservePosition = aaveV3LoanReservePositions.find((r) =>
          isAddressEqual(getAddress(r.reserve.underlyingAsset.address), getAddress(market.loanAsset.address))
        );

        if (aaveV3CollateralReservePosition && aaveV3LoanReservePosition) {
          migratableAaveV3BorrowPositions.push({
            aaveV3CollateralReservePosition,
            aaveV3LoanReservePosition,
            aaveFullPositionMetrics: {
              totalBorrowUsd,
              totalCollateralUsd,
              liquidationBorrowThresholdUsd,
            },
            destinationMarketPosition,
          });
        }
      }
    }

    return migratableAaveV3BorrowPositions;
  }, [aaveV3MarketPosition, marketPositions]);

  // Event to better understand how many users have migratable positions
  const { address } = useAccount();
  const [hasLoggedEvent, setHasLoggedEvent] = useState(false);
  useEffect(() => {
    if (migratableAaveV3BorrowPositions && migratableAaveV3BorrowPositions.length > 0 && !hasLoggedEvent && address) {
      trackEvent("found-migratable-market-positions", {
        address,
        numPositions: migratableAaveV3BorrowPositions.length,
        totalLoanValueUsd: migratableAaveV3BorrowPositions.reduce(
          (acc, p) => acc + p.aaveV3LoanReservePosition.aTokenAssetsUsd,
          0
        ),
        totalCollateralValueUsd: migratableAaveV3BorrowPositions.reduce(
          (acc, p) => acc + p.aaveV3CollateralReservePosition.aTokenAssetsUsd,
          0
        ),
      });
      setHasLoggedEvent(true);
    }
  }, [migratableAaveV3BorrowPositions, hasLoggedEvent, setHasLoggedEvent, address]);

  return {
    data: migratableAaveV3BorrowPositions,
    isLoading: isAavePositionLoading || isMarketPositionsLoading,
    error: aaveV3MarketPositionError || marketPositionsError,
  };
}

export function useMigratableAaveV3BorrowPosition(marketId: MarketId) {
  const { data, isLoading, error } = useMigratableAaveV3BorrowPositions();
  const ret = useMemo(
    () => data?.find((p) => isAddressEqual(getAddress(p.destinationMarketPosition.market!.marketId), marketId)),
    [data, marketId]
  );

  return { data: ret, isLoading, error };
}
