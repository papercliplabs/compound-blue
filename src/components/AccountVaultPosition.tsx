"use client";
import Image from "next/image";
import { ReactNode } from "react";
import { getAddress } from "viem";
import { useAccount } from "wagmi";

import { Vault } from "@/data/whisk/getVault";
import { useAccountVaultPosition, useAccountVaultPositionAggregate } from "@/hooks/useAccountVaultPosition";
import { descaleBigIntToNumber } from "@/utils/format";

import Apy from "./Apy";
import { MetricWithTooltip } from "./Metric";
import NumberFlow, { NumberFlowWithLoading } from "./ui/NumberFlow";
import { Skeleton } from "./ui/skeleton";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";

interface VaultPositionProps {
  vault: Vault;
}

export function AccountVaultPosition({ vault }: VaultPositionProps) {
  const { data: vaultPosition, isLoading } = useAccountVaultPosition(getAddress(vault.vaultAddress));

  const balance = descaleBigIntToNumber(vaultPosition?.supplyAssets ?? 0n, vault.asset.decimals);

  const items: { label: string; description: string; value: ReactNode }[] = [
    {
      label: "Balance",
      description: "Your position's balance.",
      value: <NumberFlow value={balance} />,
    },
    {
      label: "APY",
      description: "The current APY of your position including rewards and fees. This will equal the vault's APY.",
      value: <Apy type="supply" apy={vault.supplyApy} className="gap-1" />,
    },
  ];

  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="flex w-full justify-between">
          <TooltipPopover>
            <TooltipPopoverTrigger>{item.label}</TooltipPopoverTrigger>
            <TooltipPopoverContent>{item.description}</TooltipPopoverContent>
          </TooltipPopover>
          <span className="label-md">{isLoading ? <Skeleton className="h-5 w-12" /> : item.value}</span>
        </div>
      ))}
    </>
  );
}

export function AccountVaultPositionHighlight({ vault }: { vault: Vault }) {
  const { address } = useAccount();
  const { data: vaultPosition } = useAccountVaultPosition(getAddress(vault.vaultAddress));

  // Hide if not connected
  if (!address || !vaultPosition) {
    return null;
  }

  return (
    <div className="flex flex-col md:items-end md:text-end">
      <MetricWithTooltip
        label={<span className="justify-end text-accent-secondary">Supplying</span>}
        tooltip="Your supply balance in this vault."
        className="title-3 md:items-end"
      >
        <NumberFlow value={vaultPosition.supplyAssetsUsd ?? 0} format={{ currency: "USD" }} />
      </MetricWithTooltip>
      <div className="flex items-center gap-1 text-content-secondary label-sm">
        {vault.asset.icon && (
          <Image src={vault.asset.icon} width={12} height={12} alt={vault.asset.symbol} className="rounded-full" />
        )}
        <NumberFlow
          value={descaleBigIntToNumber(BigInt(vaultPosition.supplyAssets), vault.asset.decimals)}
          className="label-sm"
        />
      </div>
    </div>
  );
}

export function AccountVaultPositionAggregate() {
  const { data: accountVaultPositionAggregate, isLoading } = useAccountVaultPositionAggregate();
  return (
    <div className="flex gap-10 md:text-end">
      <MetricWithTooltip
        label={<span className="justify-end text-accent-secondary">Your Deposits</span>}
        tooltip="Your total deposit balance across all vaults."
        className="title-3 md:items-end"
      >
        <NumberFlowWithLoading
          value={accountVaultPositionAggregate?.totalSupplyUsd}
          format={{ currency: "USD" }}
          isLoading={isLoading}
          loadingContent={<Skeleton className="h-[36px] w-[70px]" />}
        />
      </MetricWithTooltip>

      <MetricWithTooltip
        label={<span className="justify-end">Avg. Earn APY</span>}
        tooltip="Your average supply APY across all vaults, including rewards and fees."
        className="title-3 md:items-end"
      >
        <NumberFlowWithLoading
          value={accountVaultPositionAggregate?.avgApy}
          format={{ style: "percent" }}
          isLoading={isLoading}
          loadingContent={<Skeleton className="h-[36px] w-[70px]" />}
        />
      </MetricWithTooltip>
    </div>
  );
}
