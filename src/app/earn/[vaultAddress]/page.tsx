import Apy from "@/components/Apy";
import { LinkExternalBlockExplorer } from "@/components/LinkExternal";
import MarketAllocationTable from "@/components/tables/MarketAllocationTable";
import Metric from "@/components/Metric";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, Skeletons } from "@/components/ui/skeleton";
import { getVault } from "@/data/whisk/getVault";
import { formatNumber } from "@/utils/format";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ReactNode, Suspense } from "react";
import { Address, getAddress } from "viem";
import { UserVaultPosition, UserVaultPositionHighlight } from "@/components/UserVaultPosition";
import VaultActions from "@/components/VaultActions";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compound Blue | Vault",
};

export default async function VaultPage({ params }: { params: Promise<{ vaultAddress: string }> }) {
  let vaultAddress: Address;
  try {
    vaultAddress = getAddress((await params).vaultAddress);
  } catch {
    return <div>Invalid vault address</div>;
  }

  return (
    <>
      <section className="flex flex-col justify-between gap-6 md:flex-row">
        <div className="flex flex-col gap-3">
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
            <VaultMetadata vaultAddress={vaultAddress} />
          </Suspense>
        </div>

        <UserVaultPositionHighlight vaultAddress={vaultAddress} />
      </section>

      <div className="flex w-full flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 grow flex-col gap-5">
          <Card>
            <CardHeader>Key Metrics</CardHeader>
            <CardContent>
              <Suspense
                fallback={
                  <div className="flex flex-wrap gap-x-8 gap-y-4">
                    <Skeletons count={3} className="h-[56px] flex-1" />
                  </div>
                }
              >
                <VaultState vaultAddress={vaultAddress} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Market Allocation</CardHeader>
            <CardContent className="p-0">
              <Suspense fallback={<Skeleton className="m-4 h-[400px] rounded-[16px]" />}>
                <MarketAllocationTableWrapper vaultAddress={vaultAddress} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Vault Info</CardHeader>
            <CardContent>
              <Suspense
                fallback={
                  <div className="grid grid-cols-3 gap-y-10">
                    <Skeletons count={6} className="h-[56px] w-[180px] grow" />
                  </div>
                }
              >
                <VaultInfo vaultAddress={vaultAddress} />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-[min(364px,100%)] flex-col gap-5 md:max-w-[364px]">
          <Suspense
            fallback={
              <Card>
                <CardContent>
                  <Skeleton className="h-[170px] w-full" />
                </CardContent>
              </Card>
            }
          >
            <VaultActionsWrapper vaultAddress={vaultAddress} />
          </Suspense>
          <Card>
            <CardContent className="flex flex-col gap-7">
              <span className="font-semibold text-content-secondary paragraph-sm">Position Summary</span>
              <UserVaultPosition vaultAddress={vaultAddress} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

async function VaultMetadata({ vaultAddress }: { vaultAddress: Address }) {
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
      {vault.metadata?.description && (
        <p className="w-full max-w-[600px] font-medium text-content-secondary">{vault.metadata?.description}</p>
      )}
    </div>
  );
}

async function VaultState({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return null;
  }

  const metrics: { label: string; description: string; value: ReactNode }[] = [
    {
      label: "Total Deposits",
      description: "The total amount of assets currently deposited into the vault.",
      value: formatNumber(vault.supplyAssetsUsd, { currency: "USD" }),
    },
    {
      label: "Available Liquidity",
      description: "The available assets that are not currently bring borrowed.",
      value: formatNumber(vault.liquidityAssetsUsd, { currency: "USD" }),
    },
    {
      label: "APY",
      description: "The annual percent yield (APY) earned by depositing into this vault.",
      value: <Apy type="supply" apy={vault.supplyApy} />,
    },
  ];

  return (
    <div className="flex flex-wrap justify-between gap-x-8 gap-y-4">
      {metrics.map((metric, i) => (
        <Metric key={i} label={metric.label} description={metric.description} className="flex-1">
          <span className="title-3">{metric.value}</span>
        </Metric>
      ))}
    </div>
  );
}

async function MarketAllocationTableWrapper({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return null;
  }

  return <MarketAllocationTable allocations={vault.marketAllocations} />;
}

async function VaultInfo({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return <div>Vault not found</div>;
  }

  const metrics: { label: string; description: string; value: ReactNode }[] = [
    {
      label: "Performance Fee",
      description: "TODO.",
      value: formatNumber(vault.performanceFee, { style: "percent" }),
    },
    {
      label: "Fee Recipient",
      description: "TODO.",
      value: vault.feeRecipientAddress ? (
        <LinkExternalBlockExplorer address={getAddress(vault.feeRecipientAddress)} />
      ) : (
        "None"
      ),
    },
    {
      label: "Owner",
      description: "TODO.",
      value: vault.ownerAddress ? <LinkExternalBlockExplorer address={getAddress(vault.ownerAddress)} /> : "None",
    },
    {
      label: "Vault Address",
      description: "TODO",
      value: vault.vaultAddress ? <LinkExternalBlockExplorer address={getAddress(vault.vaultAddress)} /> : "None",
    },
    {
      label: "Curator",
      description: "TODO",
      value: vault.curatorAddress ? <LinkExternalBlockExplorer address={getAddress(vault.curatorAddress)} /> : "None",
    },
    {
      label: "Guardian",
      description: "",
      value: vault.guardianAddress ? <LinkExternalBlockExplorer address={getAddress(vault.guardianAddress)} /> : "None",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-y-4 md:grid-cols-3 md:gap-y-10">
      {metrics.map((metric, i) => (
        <Metric key={i} label={metric.label} description={metric.description}>
          <span className="title-5">{metric.value}</span>
        </Metric>
      ))}
    </div>
  );
}

async function VaultActionsWrapper({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return null;
  }

  return <VaultActions vault={vault} />;
}

export const dynamic = "force-static";
export const revalidate = 60;
