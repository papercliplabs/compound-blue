"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Hex } from "viem";
import { useAccount } from "wagmi";

import { AccountMarketPositions } from "@/data/whisk/getAccountMarketPositions";
import { safeFetch } from "@/utils/fetch";

export function useAccountMarketPositions() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["user-market-positions", address],
    queryFn: async () => safeFetch<AccountMarketPositions>(`/api/account/${address}/market-positions`, {}, true),
    enabled: !!address,
  });
}

export function useAccountMarketPosition(marketId: Hex) {
  const { data: userMarketPositions, ...rest } = useAccountMarketPositions();

  const marketPosition = useMemo(() => {
    return userMarketPositions?.[marketId];
  }, [userMarketPositions, marketId]);

  return { data: marketPosition, ...rest };
}

export function useAccountMarketPositionAggregate() {
  const { data: accountMarketPositions, ...rest } = useAccountMarketPositions();

  const data = useMemo(() => {
    if (accountMarketPositions == undefined) {
      return undefined;
    }

    const { totalBorrowUsd, avgApy } = Object.values(accountMarketPositions).reduce(
      (acc, marketPosition) => {
        return {
          totalBorrowUsd: acc.totalBorrowUsd + marketPosition.borrowAssetsUsd,
          avgApy: acc.avgApy + (marketPosition.market?.borrowApy.total ?? 0) * marketPosition.borrowAssetsUsd,
        };
      },
      { totalBorrowUsd: 0, avgApy: 0 }
    );

    return {
      totalBorrowUsd,
      avgApy: totalBorrowUsd > 0 ? avgApy / totalBorrowUsd : 0,
    };
  }, [accountMarketPositions]);

  return {
    data,
    ...rest,
  };
}
