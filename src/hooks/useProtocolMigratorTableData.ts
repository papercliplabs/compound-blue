import { useMemo } from "react";

import { TokenConfig } from "@/data/whisk/fragments";

import { useAaveV3MarketPosition } from "./useAaveV3MarketPosition";

export const supportedProtocolsForProtocolMigration = ["aave-v3"] as const;
export type SupportedProtocolsForProtocolMigration = (typeof supportedProtocolsForProtocolMigration)[number];

export interface ProtocolMigrationTableEntry {
  protocol: {
    name: string;
    icon: string;
    key: SupportedProtocolsForProtocolMigration;
  };
  supplyAssets: TokenConfig[];
  borrowAssets: TokenConfig[];
  totalMigratableValueUsd: number;
}

export function useProtocolMigratorTableData(): {
  data: ProtocolMigrationTableEntry[] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const aaveV3MarketPosition = useAaveV3MarketPosition();

  const data = useMemo(() => {
    if (!aaveV3MarketPosition.data) {
      return undefined;
    }

    const aaveV3CollateralReservePositions = aaveV3MarketPosition.data.reservePositions.filter(
      (r) => BigInt(r.aTokenAssets) > 0n
    );

    const aaveV3LoanReservePositions = aaveV3MarketPosition.data.reservePositions.filter(
      (r) => BigInt(r.borrowAssets) > 0n
    );

    const data = [
      {
        protocol: {
          name: "Aave v3",
          icon: "/aave.png",
          key: "aave-v3" as SupportedProtocolsForProtocolMigration,
        },
        supplyAssets: aaveV3CollateralReservePositions.map((position) => position.reserve.underlyingAsset),
        borrowAssets: aaveV3LoanReservePositions.map((position) => position.reserve.underlyingAsset),
        totalMigratableValueUsd:
          aaveV3MarketPosition.data.totalCollateralBalanceUsd - aaveV3MarketPosition.data.totalBorrowBalanceUsd,
      },
    ];

    return data;
  }, [aaveV3MarketPosition]);

  return {
    data,
    isLoading: aaveV3MarketPosition.isLoading,
    error: aaveV3MarketPosition.error,
  };
}

export function useProtocoMigratorTableDataEntry(protocolKey: SupportedProtocolsForProtocolMigration) {
  const { data, isLoading, error } = useProtocolMigratorTableData();

  const protocolEntry = useMemo(() => {
    return data?.find((entry) => entry.protocol.key === protocolKey);
  }, [data, protocolKey]);

  return {
    data: protocolEntry,
    isLoading,
    error,
  };
}
