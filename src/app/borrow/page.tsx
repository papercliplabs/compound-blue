import { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { AccountMarketPositionAggregate } from "@/components/AccountMarketPosition";
import { BorrowSummaryMetrics, BorrowSummaryMetricsSkeleton } from "@/components/BorrowSummaryMetrics";
import ProtocolMigratorBanner from "@/components/ProtocolMigrator/ProtocolMigratorBanner";
import BorrowTable from "@/components/tables/BorrowTable";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketSummary, getMarketSummaries } from "@/data/whisk/getMarketSummaries";

export const metadata: Metadata = {
  title: "Compound Blue | Borrow",
};

export default function BorrowPage() {
  return (
    <>
      <div className="flex flex-col gap-8 pt-8">
        <ProtocolMigratorBanner variant="borrow" />

        <section className="flex flex-col justify-between gap-8 md:flex-row md:gap-2">
          <div className="flex h-[60px] items-center gap-4">
            <Image src="/polygon.png" width={56} height={56} alt="Polygon" className="rounded-[12px]" />
            <div className="flex h-full flex-col justify-between">
              <h1 className="title-2">
                Borrow <span className="text-content-secondary">• Polygon</span>
              </h1>
              <p className="text-content-secondary">Provide collateral to borrow any asset.</p>
            </div>
          </div>
        </section>

        <Suspense fallback={<BorrowSummaryMetricsSkeleton />}>
          <BorrowSummaryMetricsWrapper />
        </Suspense>
      </div>

      <Card>
        <CardHeader>Markets</CardHeader>
        <CardContent className="p-0">
          <Suspense fallback={<Skeleton className="m-8 h-[906px]" />}>
            <BorrowTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function BorrowSummaryMetricsWrapper() {
  const marketSummaries = await getMarketSummaries();
  return <BorrowSummaryMetrics marketSummaries={(marketSummaries as MarketSummary[]) ?? []} />;
}

async function BorrowTableWrapper() {
  const marketSummaries = await getMarketSummaries();
  return <BorrowTable marketSummaries={(marketSummaries as MarketSummary[]) ?? []} />;
}

export const dynamic = "force-static";
export const revalidate = 300; // 5 min
