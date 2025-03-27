"use client";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { Card, CardContent, CardHeader } from "./ui/card";
import VaultMigrationTable from "./tables/VaultMigrationTable";
import { useAccount } from "wagmi";
import Wallet from "./ui/icons/Wallet";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import VaultMigrationAction from "./MigrationActions/VaultMigrationAction";
import { useState } from "react";
import {
  MigratableAaveV3SupplyPosition,
  useMigratableAaveV3SupplyPositions,
} from "@/hooks/useMigratableAaveV3SupplyPosition";
import { Skeleton } from "./ui/skeleton";
import EarnEducationalSummary from "./EducationalSummary/EarnEducationalSummary";
import BorrowEducationalSummary from "./EducationalSummary/BorrowEducationalSummary";

interface MigrateContentProps {
  vaultSummaries: VaultSummary[];
}

export default function MigratePageContent({ vaultSummaries }: MigrateContentProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  if (!isConnected) {
    return (
      <div className="flex w-full flex-col items-center gap-5 rounded-[12px] bg-background-secondary px-4 py-16 text-center">
        <Wallet className="h-12 w-12 fill-content-secondary" />
        <span className="text-content-secondary label-lg">Connect your wallet to view your migratable positions.</span>
        <Button onClick={openConnectModal}>Connect Wallet</Button>
        <div className="flex w-full flex-col justify-center gap-6 pt-9 md:flex-row">
          <EarnEducationalSummary showLink={false} />
          <BorrowEducationalSummary showLink={false} />
        </div>
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
  const [selected, setSelected] = useState<MigratableAaveV3SupplyPosition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: migratableVaultPositions, isLoading } = useMigratableAaveV3SupplyPositions();

  if (isLoading) {
    return <Skeleton className="m-8 h-[336px]" />;
  }

  if (migratableVaultPositions?.length == 0) {
    return (
      <div className="flex flex-col items-center p-8 text-center">
        <p className="text-content-secondary label-lg">You don&apos;t have any migratable positions.</p>
        <div className="flex w-full flex-col justify-center gap-6 pt-9 md:flex-row">
          <EarnEducationalSummary showLink={true} />
          <BorrowEducationalSummary showLink={true} />
        </div>
      </div>
    );
  }

  return (
    <>
      <VaultMigrationTable
        data={migratableVaultPositions ?? []}
        onRowClick={(entry) => {
          setSelected(entry);
          setDialogOpen(true);
        }}
      />

      {selected && (
        <VaultMigrationAction
          open={dialogOpen}
          onOpenChange={(open) => setDialogOpen(open)}
          migratableAaveV3SupplyPosition={selected}
          vault={vaultSummaries.find((v) => v.vaultAddress === selected.destinationVaultPosition.vaultAddress)!} // Guaranteed to exist
        />
      )}
    </>
  );
}
