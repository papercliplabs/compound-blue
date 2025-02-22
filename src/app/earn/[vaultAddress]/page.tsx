import { getVault } from "@/data/whisk/getVault";
import { formatNumber } from "@/utils/format";
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
    <div>
      <Link href="/earn">Back to earn</Link>
      <Suspense fallback={<div>Loading...</div>}>
        <VaultWrapper vaultAddress={vaultAddress} />
      </Suspense>
    </div>
  );
}

async function VaultWrapper({ vaultAddress }: { vaultAddress: Address }) {
  const vault = await getVault(vaultAddress);

  if (!vault) {
    return <div>Vault not found</div>;
  }

  return (
    <div>
      <h1>{vault.name}</h1>
      <p>{vault.metadata?.description}</p>

      <div className="flex gap-3">
        <div>Total deposits: {formatNumber(vault.supplyAssetsUsd, { currency: "USD" })}</div>
        <div>Liquditiy: {formatNumber(vault.liquidityAssetsUsd, { currency: "USD" })}</div>
        <div>APY: {formatNumber(vault.supplyApy.total, { style: "percent" })}</div>
      </div>

      <div>
        Market allocations:
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
      </div>

      <div>
        Vault info
        <div className="flex flex-col">
          <span>{formatNumber(vault.performanceFee, { style: "percent" })}</span>
          <span>{formatNumber(vault.supplyAssetsUsd, { currency: "USD" })}</span>
          <span>{formatNumber(vault.liquidityAssetsUsd, { currency: "USD" })}</span>
          <span>{vault.vaultAddress}</span>
          <span>{vault.guardianAddress}</span>
        </div>
      </div>
    </div>
  );
}
// export const revalidate = 60;
