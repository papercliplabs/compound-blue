import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import BackButton from "@/components/BackButton";
import ProtocolMigratorController from "@/components/ProtocolMigrator/ProtocolMigratorController";
import ProtocolMigratorValueHighlight from "@/components/ProtocolMigrator/ProtocolMigratorValueHighlight";
import { Skeletons } from "@/components/ui/skeleton";
import { MarketSummary, getMarketSummaries } from "@/data/whisk/getMarketSummaries";
import { getVaultSummaries } from "@/data/whisk/getVaultSummaries";
import {
  SupportedProtocolsForProtocolMigration,
  supportedProtocolsForProtocolMigration,
} from "@/hooks/useProtocolMigratorTableData";

export const metadata: Metadata = {
  title: "Compound Blue | Protocol Migration",
};

export default async function VaultPage({ params }: { params: Promise<{ protocolKey: string }> }) {
  const protocolKey = (await params).protocolKey as SupportedProtocolsForProtocolMigration;
  if (!supportedProtocolsForProtocolMigration.includes(protocolKey)) {
    return <UnsupportedProtocol />;
  }

  return (
    <>
      <section className="flex flex-col justify-between gap-6">
        <Link href="/migrate" className="flex items-center gap-2 text-content-secondary label-md">
          <ArrowLeft size={16} className="stroke-content-secondary" /> Migrate
        </Link>

        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="flex items-center gap-4">
            <Image src="/aave.png" alt="Polygon" width={56} height={56} className="size-[56px] rounded-[12px]" />
            <div className="flex h-full flex-col gap-1">
              <h2 className="inline text-content-secondary">
                <span className="text-content-primary">Aave v3</span> • Polygon
              </h2>
              <p className="text-content-secondary">Migrate your assets in Aave v3 over to Compound Blue.</p>
            </div>
          </div>

          <ProtocolMigratorValueHighlight protocolKey={protocolKey} />
        </div>

        <div className="h-[1px] w-full bg-border-primary" />
      </section>

      <section>
        <Suspense fallback={<Skeletons count={2} className="mb-6 h-[250px] w-full max-w-[735px]" />}>
          <ProtocolMigratorControllerWrapper protocolKey={protocolKey} />
        </Suspense>
      </section>
    </>
  );
}

function UnsupportedProtocol() {
  return (
    <div className="flex w-full grow flex-col items-center justify-center gap-6 text-center">
      <h1>Unsupported Protocol</h1>
      <p className="text-content-secondary">
        This protocol is not currently supported for migration on the Compound Blue interface.
      </p>
      <BackButton />
    </div>
  );
}

async function ProtocolMigratorControllerWrapper({
  protocolKey,
}: {
  protocolKey: SupportedProtocolsForProtocolMigration;
}) {
  const marketSummaries = await getMarketSummaries();
  const vaultSummaries = await getVaultSummaries();

  if (!marketSummaries || !vaultSummaries) {
    return null;
  }

  return (
    <ProtocolMigratorController
      protocolKey={protocolKey}
      marketSummaries={marketSummaries as MarketSummary[]}
      vaultSummaries={vaultSummaries}
    />
  );
}

export const dynamic = "force-static";
export const revalidate = 300; // 5 min
