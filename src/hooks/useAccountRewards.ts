"use client";
import { useQuery } from "@tanstack/react-query";
import { safeFetch } from "@/utils/fetch";
import { useAccount } from "wagmi";
import { AccountRewards } from "@/data/whisk/getAccountRewards";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";

export function useAccountRewards() {
  const { pollingInterval, revalidateSignal } = useAccountDataPollingContext();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["account-rewards", address, revalidateSignal],
    queryFn: async () => safeFetch<AccountRewards>(`/api/account/${address}/rewards`),
    enabled: !!address,
    refetchInterval: pollingInterval,
    placeholderData: (prev) => prev,
  });
}
