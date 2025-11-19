import { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { EarnSummaryMetrics, EarnSummaryMetricsSkeleton } from "@/components/EarnSummaryMetrics";
import EarnTable from "@/components/tables/EarnTable";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVaultSummaries } from "@/data/whisk/getVaultSummaries";

export const metadata: Metadata = {
  title: "Compound Blue | Earn",
};

export default async function EarnPage() {
  return (
    <>
      <div className="flex flex-col gap-8 pt-8">
        <section className="flex flex-col justify-between gap-8 md:flex-row md:gap-2">
          <div className="flex h-[60px] items-center gap-4">
            <Image src="/polygon.png" width={56} height={56} alt="Polygon" className="rounded-[12px]" />
            <div className="flex h-full flex-col justify-between">
              <h1 className="title-2">
                Earn <span className="text-content-secondary">• Polygon</span>
              </h1>
              <p className="text-content-secondary">Earn yield on assets by lending them out.</p>
            </div>
          </div>
        </section>

        <Suspense fallback={<EarnSummaryMetricsSkeleton />}>
          <EarnSummaryMetricsWrapper />
        </Suspense>
      </div>

      <Card>
        <CardHeader>Vaults</CardHeader>
        <CardContent className="p-0">
          <Suspense fallback={<Skeleton className="m-8 h-[336px]" />}>
            <EarnTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function EarnSummaryMetricsWrapper() {
  const vaultSummaries = await getVaultSummaries();
  return <EarnSummaryMetrics vaultSummaries={vaultSummaries ?? []} />;
}

async function EarnTableWrapper() {
  const vaultSummaries = await getVaultSummaries();
  return <EarnTable vaultSummaries={vaultSummaries ?? []} />;
}

export const dynamic = "force-static";
export const revalidate = 300; // 5 min
