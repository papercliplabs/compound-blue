"use client";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { useAaveV3MarketPosition } from "./useAaveV3MarketPosition";
import { useAccountVaultPositions } from "./useAccountVaultPosition";
import { AccountVaultPosition } from "@/data/whisk/getAccountVaultPositions";
import { AaveV3ReservePosition } from "@/data/whisk/getAaveV3MarketPosition";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { getAddress, isAddressEqual } from "viem";
import { trackEvent } from "@/data/trackEvent";

export interface VaultMigrationTableEntry {
  sourcePosition: AaveV3ReservePosition;
  destinationPosition: AccountVaultPosition;
  destinationVaultSummary: VaultSummary;
}

export function useVaultMigrationTableData({ vaultSummaries }: { vaultSummaries: VaultSummary[] }) {
  const {
    data: sourcePosition,
    isLoading: isSourcePositionLoading,
    error: sourcePositionError,
  } = useAaveV3MarketPosition();

  const {
    data: destinationPosition,
    isLoading: isDestinationPositionLoading,
    error: destinationPositionError,
  } = useAccountVaultPositions();

  const data = useMemo(() => {
    if (!sourcePosition || !destinationPosition) {
      return undefined;
    }

    // If the user has no borrows, we can migrate all supply positions even if the it's enabled as collateral.
    // AAVE UI automatically enables some assets as collateral, so this gives us more targettable assets.
    const migratableSupplyReserves = sourcePosition?.reservePositions.filter(
      (r) => r.aTokenAssetsUsd > 0 && (!r.isUsageAsCollateralEnabled || sourcePosition.totalBorrowBalanceUsd == 0)
    );

    const entries: VaultMigrationTableEntry[] = [];

    for (const destinationVaultPosition of Object.values(destinationPosition)) {
      const destinationVaultSummary = vaultSummaries.find((v) =>
        isAddressEqual(getAddress(v.vaultAddress), getAddress(destinationVaultPosition.vault.vaultAddress))
      );

      if (destinationVaultSummary) {
        const aaveV3ReservePosition = migratableSupplyReserves?.find((r) =>
          isAddressEqual(
            getAddress(r.reserve.underlyingAsset.address),
            getAddress(destinationVaultSummary.asset.address)
          )
        );

        if (aaveV3ReservePosition) {
          entries.push({
            sourcePosition: aaveV3ReservePosition,
            destinationPosition: destinationVaultPosition,
            destinationVaultSummary,
          });
        }
      }
    }

    return entries;
  }, [sourcePosition, destinationPosition, vaultSummaries]);

  // Event to better understand how many users have migratable positions
  const { address } = useAccount();
  const [hasLoggedEvent, setHasLoggedEvent] = useState(false);
  useEffect(() => {
    if (data && data.length > 0 && !hasLoggedEvent && address) {
      void trackEvent("found-migratable-vault-positions", {
        address,
        numPositions: data.length,
        totalValueUsd: data.reduce((acc, p) => acc + p.sourcePosition.aTokenAssetsUsd, 0),
      });
      setHasLoggedEvent(true);
    }
  }, [data, hasLoggedEvent, setHasLoggedEvent, address]);

  return {
    data,
    isLoading: isSourcePositionLoading || isDestinationPositionLoading,
    error: sourcePositionError || destinationPositionError,
  };
}
