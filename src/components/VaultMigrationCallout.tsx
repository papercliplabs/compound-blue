"use client";
import { Button } from "./ui/button";
import NumberFlow from "./ui/NumberFlow";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import VaultMigrationAction from "./MigrationActions/VaultMigrationAction";
import { useState } from "react";
import { useVaultMigrationTableData } from "@/hooks/useVaultMigrationTableData";

export default function VaultMigrationCallout({ vault }: { vault: VaultSummary }) {
  const [open, setOpen] = useState(false);
  const { data: entries } = useVaultMigrationTableData({ vaultSummaries: [vault] });

  if (!entries || entries.length == 0) {
    return null;
  }

  const migrationData = entries[0];
  const yieldDelta = vault.supplyApy.total - migrationData.sourcePosition.reserve.supplyApy.total;

  return (
    <>
      <div className="flex w-full items-center justify-between gap-4 p-4 lg:px-8 lg:py-6 lg:pb-3">
        <div className="flex flex-col gap-1">
          {yieldDelta > 0 && (
            <span className="text-accent-secondary label-md">
              Boost your APY by <NumberFlow value={yieldDelta} format={{ style: "percent" }} />
            </span>
          )}
          <span>Migrate your {vault.asset.symbol} from Aave</span>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Migrate
        </Button>
      </div>

      <VaultMigrationAction open={open} onOpenChange={setOpen} data={migrationData} />
    </>
  );
}
