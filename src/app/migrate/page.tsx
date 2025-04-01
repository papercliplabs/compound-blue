import { Metadata } from "next";
import Image from "next/image";
import { getVaultSummaries } from "@/data/whisk/getVaultSummaries";
import MigratePageContent from "@/components/MigratePageContent";
import { getMarketSummaries } from "@/data/whisk/getMarketSummaries";
export const metadata: Metadata = {
  title: "Compound Blue | Migrate",
};

export default function MigratePage() {
  return (
    <>
      <section className="flex flex-col justify-between gap-8 pt-8 md:flex-row md:gap-2">
        <div className="flex h-[60px] items-center gap-4">
          <Image src="/migrate.png" width={56} height={56} alt="Migrate" className="rounded-[12px]" />
          <div className="flex h-full flex-col justify-between">
            <h1 className="title-2">Migrate</h1>
            <p className="text-content-secondary">Move your positions to Compound Blue.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-5">
        <MigrateContentWrapper />
      </div>
    </>
  );
}

async function MigrateContentWrapper() {
  const [vaultSummaries, marketSummaries] = await Promise.all([getVaultSummaries(), getMarketSummaries()]);

  if (!vaultSummaries || !marketSummaries) {
    // Should never get here, if we do it means the getVaultSummaries call failed, and we will see it in logs
    console.error("MigrateContentWrapper: No summaries found");
    return null;
  }
  return <MigratePageContent vaultSummaries={vaultSummaries} marketSummaries={marketSummaries} />;
}

export const dynamic = "force-static";
export const revalidate = 60;
