"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Address, getAddress } from "viem";
import { useAccount } from "wagmi";

import { ACCOUNT_STATE_POLLING_INTERVAL_MS } from "@/config";
import { AccountVaultPosition, AccountVaultPositions } from "@/data/whisk/getAccountVaultPositions";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { safeFetch } from "@/utils/fetch";

export function useAccountVaultPositions() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["account-vault-positions", address],
    queryFn: async () => safeFetch<AccountVaultPositions>(`/api/account/${address}/vault-positions`, {}, true),
    enabled: !!address,
    refetchInterval: ACCOUNT_STATE_POLLING_INTERVAL_MS,
  });
}

export function useAccountVaultPosition(vaultAddress: Address) {
  const { data: userVaultPositions, ...rest } = useAccountVaultPositions();

  const vaultPosition = useMemo(() => {
    return userVaultPositions?.[vaultAddress];
  }, [userVaultPositions, vaultAddress]);

  return { data: vaultPosition, ...rest };
}

export function useAccountVaultPositionAggregate() {
  const { data: accountVaultPositions, ...rest } = useAccountVaultPositions();

  const data = useMemo(() => {
    if (accountVaultPositions == undefined) {
      return undefined;
    }

    const { totalSupplyUsd, avgApy } = Object.values(accountVaultPositions).reduce(
      (acc, vaultPosition) => {
        return {
          totalSupplyUsd: acc.totalSupplyUsd + (vaultPosition.supplyAssetsUsd ?? 0),
          avgApy: acc.avgApy + vaultPosition.vault.supplyApy.total * (vaultPosition.supplyAssetsUsd ?? 0),
        };
      },
      { totalSupplyUsd: 0, avgApy: 0 }
    );

    return {
      totalSupplyUsd,
      avgApy: totalSupplyUsd > 0 ? avgApy / totalSupplyUsd : 0,
    };
  }, [accountVaultPositions]);

  return {
    data,
    ...rest,
  };
}

// Stitch together vault summaries and account positions
export function useVaultSummaryAndAccountPositons({ vaultSummaries }: { vaultSummaries: VaultSummary[] }) {
  const { data: accountVaultPositions, isLoading } = useAccountVaultPositions();

  const data = useMemo(() => {
    const vaultSummariesWithPositions: {
      vaultSummary: VaultSummary;
      position?: AccountVaultPosition;
      isLoading: boolean;
    }[] = [];

    for (const vaultSummary of vaultSummaries) {
      const position = accountVaultPositions?.[getAddress(vaultSummary.vaultAddress)];
      vaultSummariesWithPositions.push({ vaultSummary, position, isLoading });
    }
    return vaultSummariesWithPositions;
  }, [vaultSummaries, accountVaultPositions, isLoading]);

  return data;
}
