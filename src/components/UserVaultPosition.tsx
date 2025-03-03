"use client";
import { descaleBigIntToNumber } from "@/utils/format";
import { Address, getAddress } from "viem";
import { useUserPositionContext, useUserVaultPosition } from "@/providers/UserPositionProvider";
import { ReactNode, useMemo } from "react";
import { Skeleton } from "./ui/skeleton";
import Metric from "./Metric";
import { useAccount } from "wagmi";
import Image from "next/image";
import NumberFlow from "./ui/NumberFlow";
import Apy from "./Apy";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";
import { Vault } from "@/data/whisk/getVault";

interface VaultPositionProps {
  vault: Vault;
}

export function UserVaultPosition({ vault }: VaultPositionProps) {
  const { data: vaultPosition, isLoading } = useUserVaultPosition(getAddress(vault.vaultAddress));

  const items: { label: string; description: string; value: ReactNode }[] = [
    {
      label: "Balance",
      description: "Your position's balance.",
      value: <NumberFlow value={vaultPosition?.supplyAssetsUsd ?? 0} format={{ currency: "USD" }} />,
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
        <div key={i} className="flex w-full justify-between font-semibold">
          <TooltipPopover>
            <TooltipPopoverTrigger>{item.label}</TooltipPopoverTrigger>
            <TooltipPopoverContent>{item.description}</TooltipPopoverContent>
          </TooltipPopover>
          <span>{isLoading ? <Skeleton className="h-5 w-12" /> : item.value}</span>
        </div>
      ))}
    </>
  );
}

export function UserVaultPositionHighlight({ vaultAddress }: { vaultAddress: Address }) {
  const { address } = useAccount();
  const { data: vaultPosition } = useUserVaultPosition(vaultAddress);

  // Hide if not connected
  if (!address || !vaultPosition) {
    return null;
  }

  return (
    <div className="flex flex-col md:items-end md:text-end">
      <Metric
        label={<span className="justify-end text-accent-secondary">Supplying</span>}
        description="Your supply balance in this vault."
      >
        <span className="title-3">
          <NumberFlow value={vaultPosition.supplyAssetsUsd} format={{ currency: "USD" }} />
        </span>
      </Metric>
      <div className="flex items-center gap-1 font-semibold text-content-secondary paragraph-sm">
        {vaultPosition.asset.icon && (
          <Image
            src={vaultPosition.asset.icon}
            width={12}
            height={12}
            alt={vaultPosition.asset.symbol}
            className="rounded-full"
          />
        )}
        <NumberFlow value={descaleBigIntToNumber(BigInt(vaultPosition.supplyAssets), vaultPosition.asset.decimals)} />
      </div>
    </div>
  );
}

export function UserVaultPositionAggregate() {
  const { address } = useAccount();
  const {
    userVaultPositionsQuery: { data: userVaultPositions },
  } = useUserPositionContext();

  const { totalSupplyUsd, avgApy } = useMemo(() => {
    const { totalSupplyUsd, avgApy } = Object.values(userVaultPositions ?? {}).reduce(
      (acc, vaultPosition) => {
        return {
          totalSupplyUsd: acc.totalSupplyUsd + vaultPosition.supplyAssetsUsd,
          avgApy: acc.avgApy + vaultPosition.supplyApy.total * vaultPosition.supplyAssetsUsd,
        };
      },
      { totalSupplyUsd: 0, avgApy: 0 }
    );

    return {
      totalSupplyUsd,
      avgApy: totalSupplyUsd > 0 ? avgApy / totalSupplyUsd : 0,
    };
  }, [userVaultPositions]);

  // Hide if not connected
  if (!address) {
    return null;
  }

  return (
    <div className="flex gap-10 md:text-end">
      <Metric
        label={<span className="justify-end text-accent-secondary">Your Deposits</span>}
        description="Your total deposit balance across all vaults."
      >
        <span className="title-3">
          <NumberFlow value={totalSupplyUsd} format={{ currency: "USD" }} />
        </span>
      </Metric>

      <Metric
        label={<span className="justify-end">Avg. Earn APY</span>}
        description="Your average supply APY across all vaults, including rewards and fees."
      >
        <span className="title-3">
          <NumberFlow value={avgApy} format={{ style: "percent" }} />
        </span>
      </Metric>
    </div>
  );
}
