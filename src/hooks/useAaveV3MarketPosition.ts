"use client";
import { ACCOUNT_STATE_POLLING_INTERVAL_MS } from "@/config";
import { AaveV3MarketPosition } from "@/data/whisk/getAaveV3MarketPosition";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export function useAaveV3MarketPosition() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["user-aave-v3-market-position", address],
    queryFn: async () => safeFetch<AaveV3MarketPosition>(`/api/account/${address}/aave-v3-market-position`, {}, true),
    enabled: !!address,
    refetchInterval: ACCOUNT_STATE_POLLING_INTERVAL_MS,
  });
}
