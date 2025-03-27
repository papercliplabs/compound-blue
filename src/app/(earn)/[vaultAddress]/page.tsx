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
import VaultActions from "@/components/VaultActions";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { WHITELISTED_VAULT_ADDRESSES } from "@/config";
import BackButton from "@/components/BackButton";
import { AccountVaultPosition, AccoutnVaultPositionHighlight } from "@/components/AccountVaultPosition";
import NumberFlow from "@/components/ui/NumberFlow";

export const metadata: Metadata = {
  title: "Compound Blue | Vault",
};

export default async function VaultPage({ params }: { params: Promise<{ vaultAddress: string }> }) {
  let vaultAddress: Address;
  try {
    vaultAddress = getAddress((await params).vaultAddress);
  } catch {
    notFound();
  }

  if (!WHITELISTED_VAULT_ADDRESSES.includes(vaultAddress)) {
    return <UnsupportedVault />;
  }

  return (
    <>
      <section className="flex flex-col justify-between gap-6 md:flex-row">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2 text-content-secondary label-md">
            <ArrowLeft size={16} className="stroke-content-secondary" /> Earn
          </Link>

          <Suspense
            fallback={
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="w-[400px]" />
                </div>
                <Skeleton className="h-8 w-full max-w-[600px]" />
              </div>
            }
          >
            <VaultMetadata vaultAddress={vaultAddress} />
          </Suspense>
        </div>

        <AccoutnVaultPositionHighlight vaultAddress={vaultAddress} />
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
              <Suspense fallback={<Skeleton className="m-8 h-[400px]" />}>
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

        <div className="flex min-w-[min(364px,100%)] flex-col gap-5 lg:max-w-[364px]">
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
              <span className="text-content-secondary label-sm">Position Summary</span>
              <Suspense fallback={<Skeleton className="h-[80px] w-full" />}>
                <UserVaultPositionWrapper vaultAddress={vaultAddress} />
              </Suspense>
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
    notFound();
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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="inline title-2">{vault.name}</h1>
          {vault.metadata?.riskTier && (
            <span className="inline h-[20px] w-fit rounded-[4px] bg-button-neutral px-1 text-content-secondary label-md">
              {vault.metadata.riskTier.toUpperCase()}
            </span>
          )}
        </div>
      </div>
      {vault.metadata?.description && (
        <p className="w-full max-w-[696px] text-content-secondary">{vault.metadata?.description}</p>
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
      value: <NumberFlow value={vault.supplyAssetsUsd} format={{ currency: "USD" }} />,
    },
    {
      label: "Available Liquidity",
      description: "The available assets that can be withdrawn or reallocated.",
      value: <NumberFlow value={vault.liquidityAssetsUsd} format={{ currency: "USD" }} />,
    },
    {
      label: "APY",
      description: "The annual percent yield (APY) earned by depositing into this vault, including rewards and fees.",
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
      description: "The percentage of vault profits the fee recipient receives.",
      value: formatNumber(vault.performanceFee, { style: "percent" }),
    },
    {
      label: "Fee Recipient",
      description: "The recipient of the vaults performance fee.",
      value: vault.feeRecipientAddress ? (
        <LinkExternalBlockExplorer address={getAddress(vault.feeRecipientAddress)} />
      ) : (
        "None"
      ),
    },
    {
      label: "Owner",
      description: "The entity whom owns the vault and has full control privileges.",
      value: vault.ownerAddress ? <LinkExternalBlockExplorer address={getAddress(vault.ownerAddress)} /> : "None",
    },
    {
      label: "Vault Address",
      description: "The smart contract address that holds and manages the vault's assets.",
      value: vault.vaultAddress ? <LinkExternalBlockExplorer address={getAddress(vault.vaultAddress)} /> : "None",
    },
    {
      label: "Curator",
      description: "The entity responsible for managing the vault's strategy.",
      value: vault.curatorAddress ? <LinkExternalBlockExplorer address={getAddress(vault.curatorAddress)} /> : "None",
    },
    {
      label: "Guardian",
      description: "A security role in the vault that can intervene to protect funds if needed.",
      value: vault.guardianAddress ? <LinkExternalBlockExplorer address={getAddress(vault.guardianAddress)} /> : "None",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-y-8 md:grid-cols-3 md:gap-y-10">
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

async function UserVaultPositionWrapper({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return null;
  }

  return <AccountVaultPosition vault={vault} />;
}

function UnsupportedVault() {
  return (
    <div className="flex w-full grow flex-col items-center justify-center gap-6 text-center">
      <h1>Unsupported Vault</h1>
      <p className="text-content-secondary">This vault is not currently supported on the Compound Blue interface.</p>
      <BackButton />
    </div>
  );
}

export const dynamic = "force-static";
export const revalidate = 60;
