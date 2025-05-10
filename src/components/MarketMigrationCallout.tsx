"use client";
import { useState } from "react";

import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { useMarketMigrationTableData } from "@/hooks/useMarketMigrationTableData";

import MarketMigrationAction from "./MigrationActions/MarketMigrationAction";
import { Button } from "./ui/button";
import NumberFlow from "./ui/NumberFlow";

export default function MarketMigrationCallout({ market }: { market: MarketSummary }) {
  const [open, setOpen] = useState(false);
  const { data: entries } = useMarketMigrationTableData({ marketSummaries: [market] });

  if (!entries || entries.length == 0) {
    return null;
  }

  const migrationData = entries[0];
  const yieldSavings =
    migrationData.aaveV3LoanReservePosition.reserve.borrowApy.total -
    migrationData.destinationMarketPosition.market!.borrowApy.total;

  return (
    <>
      <div className="flex w-full items-center justify-between gap-4 p-4 lg:px-8 lg:py-6 lg:pb-3">
        <div className="flex flex-col gap-1">
          {yieldSavings > 0 && (
            <span className="text-accent-ternary label-md">
              Save <NumberFlow value={yieldSavings} format={{ style: "percent" }} /> interest.
            </span>
          )}
          <span>Migrate your position from Aave</span>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} variant="borrow">
          Migrate
        </Button>
      </div>

      <MarketMigrationAction open={open} onOpenChange={setOpen} migrationData={migrationData} />
    </>
  );
}
