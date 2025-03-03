"use client";
import { useQuery } from "@tanstack/react-query";
import { safeFetch } from "@/utils/fetch";
import { useAccount } from "wagmi";

export function useAccountIsOfacSanctioned() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["account-is-ofac-sanctioned", address],
    queryFn: async () => safeFetch<boolean>(`/api/account/${address}/is-ofac-sanctioned`),
    enabled: !!address,
  });
}
