"use client";
import { AaveV3ReservePosition } from "@/data/whisk/getAaveV3MarketPosition";
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { isAddressEqual, getAddress } from "viem";
import { trackEvent } from "@/data/trackEvent";
import { useAaveV3MarketPosition } from "./useAaveV3MarketPosition";
import { AccountMarketPosition } from "@/data/whisk/getAccountMarketPositions";
import { useAccountMarketPositions } from "./useAccountMarketPosition";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";

export interface MarketMigrationTableEntry {
  aaveV3CollateralReservePosition: AaveV3ReservePosition;
  aaveV3LoanReservePosition: AaveV3ReservePosition;
  aaveFullPositionMetrics: {
    totalBorrowUsd: number;
    totalCollateralUsd: number;
    lltv: number;
  };
  destinationMarketSummary: MarketSummary;
  destinationMarketPosition: AccountMarketPosition;
}

export function useMarketMigrationTableData({ marketSummaries }: { marketSummaries: MarketSummary[] }): {
  data?: MarketMigrationTableEntry[];
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

  const data: MarketMigrationTableEntry[] | undefined = useMemo(() => {
    if (!aaveV3MarketPosition || !marketPositions) {
      return undefined;
    }

    const aaveV3CollateralReservePositions = aaveV3MarketPosition.reservePositions.filter(
      (r) => r.aTokenAssetsUsd > 0 && r.isUsageAsCollateralEnabled
    );

    const aaveV3LoanReservePositions = aaveV3MarketPosition.reservePositions.filter((r) => r.borrowAssetsUsd > 0);

    const migratableAaveV3BorrowPositions: MarketMigrationTableEntry[] = [];
    for (const destinationMarketPosition of Object.values(marketPositions)) {
      const destinationMarketSummary = marketSummaries.find(
        (m) => m.marketId == destinationMarketPosition?.market.marketId
      );
      if (destinationMarketSummary && destinationMarketSummary.collateralAsset) {
        const aaveV3CollateralReservePosition = aaveV3CollateralReservePositions.find((r) =>
          isAddressEqual(
            getAddress(r.reserve.underlyingAsset.address),
            getAddress(destinationMarketSummary.collateralAsset!.address)
          )
        );
        const aaveV3LoanReservePosition = aaveV3LoanReservePositions.find((r) =>
          isAddressEqual(
            getAddress(r.reserve.underlyingAsset.address),
            getAddress(destinationMarketSummary.loanAsset.address)
          )
        );

        if (aaveV3CollateralReservePosition && aaveV3LoanReservePosition) {
          migratableAaveV3BorrowPositions.push({
            aaveV3CollateralReservePosition,
            aaveV3LoanReservePosition,
            aaveFullPositionMetrics: {
              totalBorrowUsd: aaveV3MarketPosition.totalBorrowBalanceUsd,
              totalCollateralUsd: aaveV3MarketPosition.totalCollateralBalanceUsd,
              lltv: aaveV3MarketPosition.lltv,
            },
            destinationMarketSummary,
            destinationMarketPosition,
          });
        }
      }
    }

    return migratableAaveV3BorrowPositions;
  }, [aaveV3MarketPosition, marketPositions, marketSummaries]);

  // Event to better understand how many users have migratable positions
  const { address } = useAccount();
  const [hasLoggedEvent, setHasLoggedEvent] = useState(false);
  useEffect(() => {
    if (data && data.length > 0 && !hasLoggedEvent && address) {
      trackEvent("found-migratable-market-positions", {
        address,
        numPositions: data.length,
        totalLoanValueUsd: data.reduce((acc, p) => acc + p.aaveV3LoanReservePosition.aTokenAssetsUsd, 0),
        totalCollateralValueUsd: data.reduce((acc, p) => acc + p.aaveV3CollateralReservePosition.aTokenAssetsUsd, 0),
      });
      setHasLoggedEvent(true);
    }
  }, [data, hasLoggedEvent, setHasLoggedEvent, address]);

  return {
    data,
    isLoading: isAavePositionLoading || isMarketPositionsLoading,
    error: aaveV3MarketPositionError || marketPositionsError,
  };
}
