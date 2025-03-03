import BorrowTable from "@/components/tables/BorrowTable";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMarketPositionAggregate } from "@/components/UserMarketPosition";
import { getMarketSummaries } from "@/data/whisk/getMarketSummaries";
import { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Compound Blue | Borrow",
};

export default function BorrowPage() {
  return (
    <>
      <section className="flex flex-col justify-between gap-8 pt-8 md:flex-row md:gap-2">
        <div className="flex h-[60px] items-center gap-4">
          <Image src="/polygon.png" width={56} height={56} alt="Polygon" className="rounded-[12px]" />
          <div className="flex h-full flex-col justify-between">
            <h1 className="title-2">
              Borrow <span className="text-content-secondary">• Polygon</span>
            </h1>
            <p className="text-content-secondary">Provide collateral to borrow any asset.</p>
          </div>
        </div>

        <UserMarketPositionAggregate />
      </section>

      <Card>
        <CardHeader>Markets</CardHeader>
        <CardContent className="p-0">
          <Suspense fallback={<Skeleton className="m-4 h-[400px] rounded-[16px]" />}>
            <BorrowTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function BorrowTableWrapper() {
  const marketSummaries = await getMarketSummaries();
  return <BorrowTable marketSummaries={marketSummaries ?? []} />;
}
