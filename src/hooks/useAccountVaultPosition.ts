"use client";
import { AccountVaultPositions } from "@/data/whisk/getAccountVaultPositions";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Address } from "viem";
import { useAccount } from "wagmi";

export function useAccountVaultPositions() {
  const { pollingInterval } = useAccountDataPollingContext();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["account-vault-positions", address],
    queryFn: async () => safeFetch<AccountVaultPositions>(`/api/account/${address}/vault-positions`),
    enabled: !!address,
    refetchInterval: pollingInterval,
  });
}

export function useAccountVaultPosition(vaultAddress: Address) {
  const { data: userVaultPositions, isLoading } = useAccountVaultPositions();

  const vaultPosition = useMemo(() => {
    return userVaultPositions?.[vaultAddress];
  }, [userVaultPositions, vaultAddress]);

  return { data: vaultPosition, isLoading };
}
