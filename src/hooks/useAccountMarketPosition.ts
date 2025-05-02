"use client";
import { ACCOUNT_STATE_POLLING_INTERVAL_MS } from "@/config";
import { AccountMarketPositions } from "@/data/whisk/getAccountMarketPositions";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Hex } from "viem";
import { useAccount } from "wagmi";

export function useAccountMarketPositions() {
  const { address } = useAccount();
  const query = useQuery({
    queryKey: ["user-market-positions", address],
    queryFn: async () => safeFetch<AccountMarketPositions>(`/api/account/${address}/market-positions`, {}, true),
    enabled: !!address,
    refetchInterval: ACCOUNT_STATE_POLLING_INTERVAL_MS,
  });

  return query;
}

export function useAccountMarketPosition(marketId: Hex) {
  const { data: userMarketPositions, isPending, isError } = useAccountMarketPositions();

  const marketPosition = useMemo(() => {
    return userMarketPositions?.[marketId];
  }, [userMarketPositions, marketId]);

  return { data: marketPosition, isPending, isError };
}

export function useAccountMarketPositionAggregate() {
  const { data: accountMarketPositions, isPending, isError } = useAccountMarketPositions();

  const { totalBorrowUsd, avgApy } = useMemo(() => {
    const { totalBorrowUsd, avgApy } = Object.values(accountMarketPositions ?? {}).reduce(
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
    data: {
      totalBorrowUsd,
      avgApy,
    },
    isPending,
    isError,
  };
}
