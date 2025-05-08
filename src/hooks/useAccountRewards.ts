"use client";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { ACCOUNT_STATE_POLLING_INTERVAL_MS } from "@/config";
import { AccountRewards } from "@/data/whisk/getAccountRewards";
import { safeFetch } from "@/utils/fetch";

export function useAccountRewards() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["account-rewards", address],
    queryFn: async () => safeFetch<AccountRewards>(`/api/account/${address}/rewards`, {}, true),
    enabled: !!address,
    refetchInterval: ACCOUNT_STATE_POLLING_INTERVAL_MS,
  });
}
