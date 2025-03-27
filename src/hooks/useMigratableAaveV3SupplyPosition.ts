"use client";
import { AaveV3MarketPosition, AaveV3ReservePosition } from "@/data/whisk/getAaveV3MarketPosition";
import { AccountVaultPosition } from "@/data/whisk/getAccountVaultPositions";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useAccountVaultPositions } from "./useAccountVaultPosition";
import { useMemo } from "react";
import { isAddressEqual, getAddress, Address } from "viem";

function useAaveV3MarketPosition() {
  const { pollingInterval, revalidateSignal } = useAccountDataPollingContext();
  const { address } = useAccount();
  const query = useQuery({
    queryKey: ["user-aave-v3-market-position", address, revalidateSignal],
    queryFn: async () => safeFetch<AaveV3MarketPosition>(`/api/account/${address}/aave-v3-market-position`),
    enabled: !!address,
    refetchInterval: pollingInterval,
    placeholderData: (prev) => prev,
  });

  return query;
}

export interface MigratableAaveV3SupplyPosition {
  aaveV3ReservePosition: AaveV3ReservePosition;
  destinationVaultPosition: AccountVaultPosition;
}

export function useMigratableAaveV3SupplyPositions(): {
  data?: MigratableAaveV3SupplyPosition[];
  isLoading: boolean;
  error: Error | null;
} {
  const {
    data: aaveV3MarketPosition,
    isLoading: isAavePositionLoading,
    error: aaveV3MarketPositionError,
  } = useAaveV3MarketPosition();

  const {
    data: vaultPositions,
    isLoading: isVaultPositionsLoading,
    error: vaultPositionsError,
  } = useAccountVaultPositions();

  const migratableAaveV3SupplyPositions = useMemo(() => {
    if (!aaveV3MarketPosition || !vaultPositions) {
      return undefined;
    }

    // If the user has no borrows, we can migrate all supply positions even if the it's enabled as collateral.
    // AAVE UI automatically enables some assets as collateral, so this gives us more targettable assets.
    const migratableSupplyReserves = aaveV3MarketPosition?.reservePositions.filter(
      (r) => r.aTokenAssetsUsd > 0 && (!r.isUsageAsCollateralEnabled || aaveV3MarketPosition.totalBorrowBalanceUsd == 0)
    );

    const migratableAaveV3SupplyPositions: MigratableAaveV3SupplyPosition[] = [];

    for (const destinationVaultPosition of Object.values(vaultPositions)) {
      const aaveV3ReservePosition = migratableSupplyReserves?.find((r) =>
        isAddressEqual(
          getAddress(r.reserve.underlyingAsset.address),
          getAddress(destinationVaultPosition.asset.address)
        )
      );
      if (aaveV3ReservePosition) {
        migratableAaveV3SupplyPositions.push({
          aaveV3ReservePosition,
          destinationVaultPosition,
        });
      }
    }

    return migratableAaveV3SupplyPositions;
  }, [aaveV3MarketPosition, vaultPositions]);

  return {
    data: migratableAaveV3SupplyPositions,
    isLoading: isAavePositionLoading || isVaultPositionsLoading,
    error: aaveV3MarketPositionError || vaultPositionsError,
  };
}

export function useMigratableAaveV3SupplyPosition(vaultAddress: Address) {
  const { data, isLoading, error } = useMigratableAaveV3SupplyPositions();
  const ret = useMemo(
    () => data?.find((p) => isAddressEqual(getAddress(p.destinationVaultPosition.vaultAddress), vaultAddress)),
    [data, vaultAddress]
  );

  return { data: ret, isLoading, error };
}
