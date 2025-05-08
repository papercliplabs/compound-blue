"use client";
import { useMemo } from "react";

import { AccountMarketPosition } from "@/data/whisk/getAccountMarketPositions";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";

import { useAccountMarketPositions } from "./useAccountMarketPosition";

export interface BorrowTableEntry {
  marketSummary: MarketSummary;
  position?: AccountMarketPosition;
  isPositionLoading: boolean;
}

// Stitch together market summaries and account positions
export function useBorrowTableData({ marketSummaries }: { marketSummaries: MarketSummary[] }): BorrowTableEntry[] {
  const { data: accountMarketPositions, isLoading } = useAccountMarketPositions();

  const data = useMemo(() => {
    const marketSummariesWithPositions: BorrowTableEntry[] = [];

    for (const marketSummary of marketSummaries) {
      const position = accountMarketPositions?.[marketSummary.marketId];
      marketSummariesWithPositions.push({ marketSummary, position, isPositionLoading: isLoading });
    }
    return marketSummariesWithPositions;
  }, [marketSummaries, accountMarketPositions, isLoading]);

  return data;
}
