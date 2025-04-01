"use client";
import { Button } from "./ui/button";
import NumberFlow from "./ui/NumberFlow";
import { useState } from "react";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { useMigratableAaveV3BorrowPosition } from "@/hooks/useMigratableAaveV3BorrowPosition";
import { MarketId } from "@morpho-org/blue-sdk";
import MarketMigrationAction from "./MigrationActions/MarketMigrationAction";

export default function MarketMigrationCallout({ market }: { market: MarketSummary }) {
  const [open, setOpen] = useState(false);
  const { data: migratablePosition } = useMigratableAaveV3BorrowPosition(market.marketId as MarketId);

  if (!migratablePosition) {
    return null;
  }

  const yieldSavings =
    migratablePosition.aaveV3LoanReservePosition.reserve.borrowApy.total -
    migratablePosition.destinationMarketPosition.market!.borrowApy.total;

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
        <Button size="sm" onClick={() => setOpen(true)} className="bg-accent-ternary">
          Migrate
        </Button>
      </div>

      <MarketMigrationAction
        open={open}
        onOpenChange={setOpen}
        migratableAaveV3BorrowPosition={migratablePosition}
        market={market}
      />
    </>
  );
}
