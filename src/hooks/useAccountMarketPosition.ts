"use client";
import { AccountMarketPositions } from "@/data/whisk/getAccountMarketPositions";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Hex } from "viem";
import { useAccount } from "wagmi";

export function useAccountMarketPositions() {
  const { pollingInterval } = useAccountDataPollingContext();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["user-market-positions", address],
    queryFn: async () => safeFetch<AccountMarketPositions>(`/api/account/${address}/market-positions`),
    enabled: !!address,
    refetchInterval: pollingInterval,
  });
}

export function useAccountMarketPosition(marketId: Hex) {
  const { data: userMarketPositions, isLoading } = useAccountMarketPositions();

  const marketPosition = useMemo(() => {
    return userMarketPositions?.[marketId];
  }, [userMarketPositions, marketId]);

  return { data: marketPosition, isLoading };
}
