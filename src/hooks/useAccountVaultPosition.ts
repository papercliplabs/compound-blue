"use client";
import { ACCOUNT_STATE_POLLING_INTERVAL_MS } from "@/config";
import { AccountVaultPositions } from "@/data/whisk/getAccountVaultPositions";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Address } from "viem";
import { useAccount } from "wagmi";

export function useAccountVaultPositions() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["account-vault-positions", address],
    queryFn: async () => safeFetch<AccountVaultPositions>(`/api/account/${address}/vault-positions`),
    enabled: !!address,
    refetchInterval: ACCOUNT_STATE_POLLING_INTERVAL_MS,
    placeholderData: (prev) => prev,
  });
}

export function useAccountVaultPosition(vaultAddress: Address) {
  const { data: userVaultPositions, isLoading } = useAccountVaultPositions();

  const vaultPosition = useMemo(() => {
    return userVaultPositions?.[vaultAddress];
  }, [userVaultPositions, vaultAddress]);

  return { data: vaultPosition, isLoading };
}
