"use client";
import { useQuery } from "@tanstack/react-query";
import { safeFetch } from "@/utils/fetch";
import { useAccount } from "wagmi";
import { Address } from "viem";
import { AccountTokenHolding } from "@/data/whisk/getAccountTokenHolding";

import { ACCOUNT_STATE_POLLING_INTERVAL_MS } from "@/config";
export function useAccountTokenHolding(tokenAddress: Address) {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["user-token-holding", tokenAddress, address],
    queryFn: async () => safeFetch<AccountTokenHolding>(`/api/account/${address}/holding/${tokenAddress}`, {}, true),
    enabled: !!address,
    refetchInterval: ACCOUNT_STATE_POLLING_INTERVAL_MS,
  });
}
