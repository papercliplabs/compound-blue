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
import Link from "next/link";
import NumberFlow from "./ui/NumberFlow";
import {
  MigratableAaveV3BorrowPosition,
  useMigratableAaveV3BorrowPositions,
} from "@/hooks/useMigratableAaveV3BorrowPosition";
import MarketMigrationTable from "./tables/MarketMigrationTable";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import MarketMigrationAction from "./MigrationActions/MarketMigrationAction";

interface MigrateContentProps {
  vaultSummaries: VaultSummary[];
  marketSummaries: MarketSummary[];
}

export default function MigratePageContent({ vaultSummaries, marketSummaries }: MigrateContentProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  if (!isConnected) {
    return (
      <div className="flex w-full flex-col items-center gap-5 rounded-[12px] bg-background-secondary px-4 py-16 text-center">
        <Wallet className="h-12 w-12 fill-content-secondary" />
        <span className="text-content-secondary label-lg">
          Connect your wallet to view your migratable earn positions.
        </span>
        <Button onClick={openConnectModal}>Connect Wallet</Button>
        <div className="flex w-full flex-col justify-center gap-6 pt-9 md:flex-row">
          <EarnEducationalSummary showLink={false} />
          <BorrowEducationalSummary showLink={false} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>Earn</CardHeader>
        <CardContent className="p-0">
          <VaultMigrationTableWrapper vaultSummaries={vaultSummaries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Borrow</CardHeader>
        <CardContent className="p-0">
          <MarketMigrationTableWrapper marketSummaries={marketSummaries} />
        </CardContent>
      </Card>
    </>
  );
}

function VaultMigrationTableWrapper({ vaultSummaries }: { vaultSummaries: MigrateContentProps["vaultSummaries"] }) {
  const [selected, setSelected] = useState<MigratableAaveV3SupplyPosition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: migratableVaultPositions, isLoading } = useMigratableAaveV3SupplyPositions();

  const maxEarnApy = vaultSummaries.reduce((max, vault) => {
    return Math.max(max, vault.supplyApy.total);
  }, 0);

  if (isLoading) {
    return <Skeleton className="m-8 h-[336px]" />;
  }

  if (migratableVaultPositions?.length == 0) {
    return (
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <div className="flex flex-col gap-4">
          <p className="text-content-secondary title-5">You don&apos;t have any migratable earn positions.</p>
          <p className="text-content-ternary paragraph-lg">
            You can explore the vaults on Compound Blue and{" "}
            <span className="text-accent-secondary">
              earn up to <NumberFlow value={maxEarnApy} format={{ style: "percent" }} />
            </span>{" "}
            APY.
          </p>
        </div>
        <div className="flex w-full flex-col justify-center gap-6 md:flex-row">
          <Link href="/">
            <Button>Go to Earn</Button>
          </Link>
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

function MarketMigrationTableWrapper({ marketSummaries }: { marketSummaries: MigrateContentProps["marketSummaries"] }) {
  const [selected, setSelected] = useState<MigratableAaveV3BorrowPosition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: migratableBorrowPositions, isLoading } = useMigratableAaveV3BorrowPositions();

  if (isLoading) {
    return <Skeleton className="m-8 h-[336px]" />;
  }

  if (migratableBorrowPositions?.length == 0) {
    return (
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <div className="flex flex-col gap-4">
          <p className="text-content-secondary title-5">You don&apos;t have any migratable borrow positions.</p>
          <p className="text-content-ternary paragraph-lg">
            You can explore the markets on Compound Blue to create a borrow.
          </p>
        </div>
        <div className="flex w-full flex-col justify-center gap-6 md:flex-row">
          <Link href="/borrow">
            <Button className="bg-accent-ternary">Go to Borrow</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <MarketMigrationTable
        data={migratableBorrowPositions ?? []}
        onRowClick={(entry) => {
          setSelected(entry);
          setDialogOpen(true);
        }}
      />

      {selected && (
        <MarketMigrationAction
          open={dialogOpen}
          onOpenChange={(open) => setDialogOpen(open)}
          migratableAaveV3BorrowPosition={selected}
          market={marketSummaries.find((m) => m.marketId === selected.destinationMarketPosition.market!.marketId)!} // Guaranteed to exist
        />
      )}
    </>
  );
}
