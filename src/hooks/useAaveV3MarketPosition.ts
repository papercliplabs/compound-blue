"use client";
import { AaveV3MarketPosition } from "@/data/whisk/getAaveV3MarketPosition";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export function useAaveV3MarketPosition() {
  const { pollingInterval, revalidateSignal } = useAccountDataPollingContext();
  const { address } = useAccount();
  const query = useQuery({
    queryKey: ["user-aave-v3-market-position", address, revalidateSignal],
    queryFn: async () => safeFetch<AaveV3MarketPosition>(`/api/account/${address}/aave-v3-market-position`),
    enabled: !!address,
    refetchInterval: pollingInterval,
    placeholderData: (prev) => prev,
  });

  return query;
}
