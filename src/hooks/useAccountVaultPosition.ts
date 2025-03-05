"use client";
import { AccountVaultPositions } from "@/data/whisk/getAccountVaultPositions";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Address } from "viem";
import { useAccount } from "wagmi";

export function useAccountVaultPositions() {
  const { pollingInterval, revalidateSignal } = useAccountDataPollingContext();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["account-vault-positions", address, revalidateSignal],
    queryFn: async () => safeFetch<AccountVaultPositions>(`/api/account/${address}/vault-positions`),
    enabled: !!address,
    refetchInterval: pollingInterval,
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
