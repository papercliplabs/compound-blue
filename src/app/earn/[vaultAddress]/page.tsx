import { Skeleton } from "@/components/ui/skeleton";
import { getVault } from "@/data/whisk/getVault";
import { formatNumber } from "@/utils/format";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Address, getAddress } from "viem";

export default async function VaultPage({ params }: { params: Promise<{ vaultAddress: string }> }) {
  let vaultAddress: Address;
  try {
    vaultAddress = getAddress((await params).vaultAddress);
  } catch {
    return <div>Invalid vault address</div>;
  }

  return (
    <>
      <Link href="/earn" className="flex items-center gap-2 font-semibold text-content-secondary">
        <ArrowLeft size={16} className="stroke-content-secondary" /> Earn
      </Link>

      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="w-[200px]" />
            </div>
            <Skeleton className="h-8 w-full max-w-[600px]" />
          </div>
        }
      >
        <VaultSummary vaultAddress={vaultAddress} />
      </Suspense>

      <section>
        <h2 className="title-3">Market allocations</h2>
        <Suspense
          fallback={
            <div className="flex flex-col">
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          }
        >
          <MarketAllocations vaultAddress={vaultAddress} />
        </Suspense>
      </section>

      <section>
        <h2 className="title-3">Vault info</h2>
        <Suspense fallback={<div>Loading :)</div>}>
          <VaultInfo vaultAddress={vaultAddress} />
        </Suspense>
      </section>
    </>
  );
}

async function VaultSummary({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Image
          src={vault.metadata?.image ?? vault.asset.icon ?? ""}
          width={36}
          height={36}
          alt={vault.asset.symbol}
          className="rounded-full"
        />
        <h1 className="title-2">{vault.name}</h1>
      </div>
      <p className="w-full max-w-[600px] font-medium text-content-secondary">{vault.metadata?.description}</p>
    </div>
  );
}

async function MarketAllocations({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return null;
  }

  return (
    <div>
      {vault.marketAllocations.map((allocation, i) => (
        <div className="flex gap-2" key={i}>
          <span>{allocation.market.name}</span>
          <span>{formatNumber(allocation.market.lltv, { style: "percent" })}</span>
          <span>{formatNumber(allocation.vaultSupplyShare, { style: "percent" })}</span>
          <span>{formatNumber(allocation.position.supplyAssetsUsd, { currency: "USD" })}</span>
          <span>{formatNumber(allocation.market.supplyApy.total, { style: "percent" })}</span>
        </div>
      ))}
    </div>
  );
}

async function VaultInfo({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return <div>Vault not found</div>;
  }

  return (
    <div className="flex flex-col">
      <span>{formatNumber(vault.performanceFee, { style: "percent" })}</span>
      <span>{formatNumber(vault.supplyAssetsUsd, { currency: "USD" })}</span>
      <span>{formatNumber(vault.liquidityAssetsUsd, { currency: "USD" })}</span>
      <span>{vault.vaultAddress}</span>
      <span>{vault.guardianAddress}</span>
    </div>
  );
}

export const dynamic = "force-static";
export const revalidate = 60;
