"use client";
import { useMemo } from "react";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { AccountVaultPosition } from "@/data/whisk/getAccountVaultPositions";
import { useAccountVaultPositions } from "./useAccountVaultPosition";

export interface EarnTableEntry {
  vaultSummary: VaultSummary;
  position?: AccountVaultPosition;
  isPositionLoading: boolean;
}

// Stitch together market summaries and account positions
export function useEarnTableData({ vaultSummaries }: { vaultSummaries: VaultSummary[] }): EarnTableEntry[] {
  const { data: positions, isLoading } = useAccountVaultPositions();

  const data = useMemo(() => {
    const vaultSummariesWithPositions: EarnTableEntry[] = [];

    for (const vaultSummary of vaultSummaries) {
      const position = positions?.[vaultSummary.vaultAddress];
      vaultSummariesWithPositions.push({ vaultSummary, position, isPositionLoading: isLoading });
    }
    return vaultSummariesWithPositions;
  }, [vaultSummaries, positions, isLoading]);

  return data;
}
