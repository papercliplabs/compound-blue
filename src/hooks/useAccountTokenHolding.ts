"use client";
import { useQuery } from "@tanstack/react-query";
import { safeFetch } from "@/utils/fetch";
import { useAccount } from "wagmi";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";
import { Address } from "viem";
import { AccountTokenHolding } from "@/data/whisk/getAccountTokenHolding";

export function useAccountTokenHolding(tokenAddress: Address) {
  const { pollingInterval, revalidateSignal } = useAccountDataPollingContext();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["user-token-holding", tokenAddress, address, revalidateSignal],
    queryFn: async () => safeFetch<AccountTokenHolding>(`/api/account/${address}/holding/${tokenAddress}`),
    enabled: !!address,
    refetchInterval: pollingInterval,
    placeholderData: (prev) => prev,
  });
}
