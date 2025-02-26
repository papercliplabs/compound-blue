import EarnTable from "@/components/tables/EarnTable";
import Image from "next/image";
import UserVaultSummary from "@/components/userPosition/UserVaultSummary";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getVaultSummaries } from "@/data/whisk/getVaultSummaries";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default async function EarnPage() {
  return (
    <>
      <section className="flex flex-col justify-between gap-8 pt-8 md:flex-row md:gap-2">
        <div className="flex items-center gap-4">
          <Image src="/polygon.png" width={56} height={56} alt="Polygon" className="rounded-[12px]" />
          <div className="flex h-full flex-col justify-between">
            <h1 className="title-2">
              Earn <span className="text-content-secondary">• Polygon</span>
            </h1>
            <p className="text-content-secondary">Earn yield on assets by lending them out.</p>
          </div>
        </div>

        <UserVaultSummary />
      </section>

      <Card>
        <CardHeader>Vaults</CardHeader>
        <CardContent className="p-0">
          <Suspense fallback={<Skeleton className="m-4 h-[400px] rounded-[16px]" />}>
            <EarnTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

async function EarnTableWrapper() {
  const vaultSummaries = await getVaultSummaries();
  return <EarnTable vaultSummaries={vaultSummaries} />;
}

export const revalidate = 60;
