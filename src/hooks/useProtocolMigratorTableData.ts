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
  totalSupplyValueUsd: number;
  totalBorrowValueUsd: number;
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

    const aaveTotalSupplyValueUsd = aaveV3CollateralReservePositions.reduce((acc, p) => acc + p.aTokenAssetsUsd, 0);
    const aaveTotalBorrowValueUsd = aaveV3LoanReservePositions.reduce((acc, p) => acc + p.borrowAssetsUsd, 0);
    const aaveTotalMigratableValueUsd = aaveTotalSupplyValueUsd - aaveTotalBorrowValueUsd;

    const data = [
      ...(aaveV3CollateralReservePositions.length > 0 || aaveV3LoanReservePositions.length > 0
        ? [
            {
              protocol: {
                name: "Aave v3",
                icon: "/aave.png",
                key: "aave-v3" as SupportedProtocolsForProtocolMigration,
              },
              supplyAssets: aaveV3CollateralReservePositions.map((position) => position.reserve.underlyingAsset),
              borrowAssets: aaveV3LoanReservePositions.map((position) => position.reserve.underlyingAsset),
              totalSupplyValueUsd: aaveTotalSupplyValueUsd,
              totalBorrowValueUsd: aaveTotalBorrowValueUsd,
              totalMigratableValueUsd: aaveTotalMigratableValueUsd,
            },
          ]
        : []),
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
