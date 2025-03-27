"use client";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { Card, CardContent, CardHeader } from "./ui/card";
import VaultMigrationTable from "./tables/VaultMigrationTable";
import { useAccount } from "wagmi";
import Wallet from "./ui/icons/Wallet";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import { isAddressEqual } from "viem";
import VaultMigration, { VaultAaveV3ReservePositionPairing } from "./MigrationActions/VaultMigration";
import { useMemo, useState } from "react";
import { useAaveV3MarketPosition } from "@/hooks/useAaveV3MarketPosition";
import { useAccountVaultPositions } from "@/hooks/useAccountVaultPosition";
import { AaveV3ReservePosition } from "@/data/whisk/getAaveV3MarketPosition";
import { AccountVaultPosition } from "@/data/whisk/getAccountVaultPositions";
import { getAddress } from "viem";
import { Skeleton } from "./ui/skeleton";

interface MigrateContentProps {
  vaultSummaries: VaultSummary[];
}

export default function MigrateContent({ vaultSummaries }: MigrateContentProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  if (!isConnected) {
    return (
      <div className="flex w-full flex-col items-center gap-5 rounded-[12px] bg-background-inverse px-4 py-16 text-center">
        <Wallet className="h-12 w-12 fill-content-secondary" />
        <span className="text-content-secondary label-lg">Connect your wallet to view your migratable positions.</span>
        <Button onClick={openConnectModal}>Connect Wallet</Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>Earn</CardHeader>
      <CardContent className="p-0">
        <VaultMigrationTableWrapper vaultSummaries={vaultSummaries} />
      </CardContent>
    </Card>
  );
}

function VaultMigrationTableWrapper({ vaultSummaries }: MigrateContentProps) {
  const [selected, setSelected] = useState<VaultAaveV3ReservePositionPairing | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: vaultReservePositionPairings, isLoading } = useAaveV3VaultMigrationPositions(vaultSummaries);

  if (isLoading) {
    return <Skeleton className="m-4 h-[336px]" />;
  }

  return (
    <>
      <VaultMigrationTable
        data={vaultReservePositionPairings}
        onRowClick={(entry) => {
          setSelected(entry);
          setDialogOpen(true);
        }}
      />

      {selected && (
        <VaultMigration
          open={dialogOpen}
          onOpenChange={(open) => setDialogOpen(open)}
          vaultReservePositionPairing={selected}
        />
      )}
    </>
  );
}

function useAaveV3VaultMigrationPositions(vaultSummaries: VaultSummary[]) {
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

  const vaultReservePositionPairings = useMemo(() => {
    const migratableSupplyReserves = aaveV3MarketPosition?.reservePositions.filter(
      (r) => !r.isUsageAsCollateralEnabled && r.aTokenAssetsUsd > 0
    );

    const vaultReservePairings: {
      vaultSummary: VaultSummary;
      reservePosition: AaveV3ReservePosition;
      vaultPosition: AccountVaultPosition;
    }[] = [];

    for (const vaultSummary of vaultSummaries) {
      const reservePosition = migratableSupplyReserves?.find((r) =>
        isAddressEqual(getAddress(r.reserve.underlyingAsset.address), getAddress(vaultSummary.asset.address))
      );
      const vaultPosition = vaultPositions?.[vaultSummary.vaultAddress];
      if (reservePosition && vaultPosition) {
        vaultReservePairings.push({ vaultSummary, vaultPosition, reservePosition });
      }
    }

    return vaultReservePairings;
  }, [aaveV3MarketPosition, vaultPositions, vaultSummaries]);

  return {
    data: vaultReservePositionPairings,
    isLoading: isAavePositionLoading || isVaultPositionsLoading,
    error: aaveV3MarketPositionError || vaultPositionsError,
  };
}
