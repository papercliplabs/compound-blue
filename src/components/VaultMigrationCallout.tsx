"use client";
import { useMigratableAaveV3SupplyPosition } from "@/hooks/useMigratableAaveV3SupplyPosition";
import { Button } from "./ui/button";
import NumberFlow from "./ui/NumberFlow";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { getAddress } from "viem";
import VaultMigrationAction from "./MigrationActions/VaultMigrationAction";
import { useState } from "react";

export default function VaultMigrationCallout({ vault }: { vault: VaultSummary }) {
  const [open, setOpen] = useState(false);
  const { data: migratablePosition } = useMigratableAaveV3SupplyPosition(getAddress(vault.vaultAddress));

  if (!migratablePosition) {
    return null;
  }

  const yieldDelta =
    migratablePosition.destinationVaultPosition.supplyApy.total -
    migratablePosition.aaveV3ReservePosition.reserve.supplyApy.total;

  return (
    <>
      <div className="flex w-full items-center justify-between gap-4 p-4 lg:px-8 lg:py-6 lg:pb-3">
        <div className="flex flex-col gap-1">
          {yieldDelta > 0 && (
            <span className="text-accent-secondary label-md">
              Boost your APY by <NumberFlow value={yieldDelta} format={{ style: "percent" }} />
            </span>
          )}
          <span>Migrate your {migratablePosition.destinationVaultPosition.asset.symbol} from Aave</span>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Migrate
        </Button>
      </div>

      <VaultMigrationAction
        open={open}
        onOpenChange={setOpen}
        migratableAaveV3SupplyPosition={migratablePosition}
        vault={vault}
      />
    </>
  );
}
