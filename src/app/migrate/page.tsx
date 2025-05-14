import { Metadata } from "next";
import Image from "next/image";

import PositionMigrator from "@/components/PositionMigrator";
import ProtocolMigratorTableWrapper from "@/components/ProtocolMigrator/ProtocolMigratorTableWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketSummary, getMarketSummaries } from "@/data/whisk/getMarketSummaries";
import { getVaultSummaries } from "@/data/whisk/getVaultSummaries";

export const metadata: Metadata = {
  title: "Compound Blue | Migrate",
};

export default function MigratePage() {
  return (
    <>
      <section className="flex flex-col justify-between gap-8 pt-8 md:flex-row md:gap-2">
        <div className="flex items-start gap-4">
          <Image src="/migrate.png" width={56} height={56} alt="Migrate" className="rounded-[12px]" />
          <div className="flex h-full flex-col justify-between">
            <h1 className="title-2">Migrate</h1>
            <p className="text-content-secondary">Move your supplied and borrowed assets to Compound Blue.</p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="protocol" className="flex flex-col gap-8">
        <TabsList className="w-[254px]">
          <TabsTrigger value="protocol">Protocol</TabsTrigger>
          <TabsTrigger value="position">Position</TabsTrigger>
        </TabsList>

        <TabsContent value="protocol">
          <ProtocolMigratorTableWrapper />
        </TabsContent>

        <TabsContent value="position">
          <div className="flex flex-col gap-5">
            <PositionMigratorWrapper />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

async function PositionMigratorWrapper() {
  const [vaultSummaries, marketSummaries] = await Promise.all([getVaultSummaries(), getMarketSummaries()]);

  if (!vaultSummaries || !marketSummaries) {
    return null;
  }
  return <PositionMigrator vaultSummaries={vaultSummaries} marketSummaries={marketSummaries as MarketSummary[]} />;
}

export const dynamic = "force-static";
export const revalidate = 300; // 5 min
