"use client";

import clsx from "clsx";
import { ReactNode, useMemo } from "react";

import { MetricWithTooltip } from "@/components/Metric";
import NumberFlow, { NumberFlowWithLoading } from "@/components/ui/NumberFlow";
import { Skeleton } from "@/components/ui/skeleton";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { useAccountVaultPositionAggregate } from "@/hooks/useAccountVaultPosition";

interface EarnSummaryMetricsProps {
  vaultSummaries: VaultSummary[];
}

function MetricSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={clsx("mt-[2px] h-[34px]", className)} {...props} />;
}

export function EarnSummaryMetrics({ vaultSummaries }: EarnSummaryMetricsProps) {
  const { data: accountVaultPositionAggregate, isLoading } = useAccountVaultPositionAggregate();

  const earnSummaryMetrics = useMemo(() => {
    const totalSuppliedUsd = vaultSummaries.reduce((acc, summary) => acc + summary.supplyAssetsUsd, 0);
    const totalLiquidityUsd = vaultSummaries.reduce((acc, summary) => acc + summary.liquidityAssetsUsd, 0);
    const totalBorrowedUsd = totalSuppliedUsd - totalLiquidityUsd;

    const userEarnApy = accountVaultPositionAggregate?.avgApy;
    const userDepositsUsd = accountVaultPositionAggregate?.totalSupplyUsd;

    return {
      totalSuppliedUsd,
      totalBorrowedUsd,
      userDepositsUsd,
      userEarnApy,
    };
  }, [vaultSummaries, accountVaultPositionAggregate]);

  return (
    <EarnSummaryMetricsLayout
      totalSupplied={
        <NumberFlow value={earnSummaryMetrics.totalSuppliedUsd} format={{ currency: "USD" }} className="title-3" />
      }
      totalBorrowed={
        <NumberFlow value={earnSummaryMetrics.totalBorrowedUsd} format={{ currency: "USD" }} className="title-3" />
      }
      userDeposited={
        <NumberFlowWithLoading
          isLoading={isLoading}
          value={earnSummaryMetrics.userDepositsUsd}
          format={{ currency: "USD" }}
          className="title-3"
          loadingContent={<MetricSkeleton className="w-[90px]" />}
        />
      }
      userEarnApy={
        <NumberFlowWithLoading
          isLoading={isLoading}
          value={earnSummaryMetrics.userEarnApy}
          format={{ style: "percent" }}
          className="title-3"
          loadingContent={<MetricSkeleton className="w-[84px]" />}
        />
      }
    />
  );
}

export function EarnSummaryMetricsSkeleton() {
  return (
    <EarnSummaryMetricsLayout
      totalSupplied={<MetricSkeleton className="w-[103px]" />}
      totalBorrowed={<MetricSkeleton className="w-[103px]" />}
      userDeposited={<MetricSkeleton className="w-[90px]" />}
      userEarnApy={<MetricSkeleton className="w-[84px]" />}
    />
  );
}

interface EarnSummaryMetricsLayoutProps {
  totalSupplied: ReactNode;
  totalBorrowed: ReactNode;
  userDeposited: ReactNode;
  userEarnApy: ReactNode;
}

function EarnSummaryMetricsLayout({
  totalSupplied,
  totalBorrowed,
  userDeposited,
  userEarnApy,
}: EarnSummaryMetricsLayoutProps) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row">
      <div className="flex gap-8">
        <MetricWithTooltip
          className="flex-1"
          label="Total supplied"
          tooltip="Total supplied across all vaults within the table."
        >
          {totalSupplied}
        </MetricWithTooltip>
        <MetricWithTooltip
          className="flex-1"
          label="Total borrowed"
          tooltip="Total borrowed across all vaults within the table."
        >
          {totalBorrowed}
        </MetricWithTooltip>
      </div>
      <div className="flex gap-8">
        <MetricWithTooltip
          label={<span className="justify-end text-accent-secondary">Your Deposits</span>}
          tooltip="Sum of your deposits across all vaults in the table."
          className="flex-1 md:items-end"
        >
          {userDeposited}
        </MetricWithTooltip>
        <MetricWithTooltip
          label="Your earn APY"
          tooltip="Your net earn APY across all vaults in the table."
          className="flex-1 md:items-end"
        >
          {userEarnApy}
        </MetricWithTooltip>
      </div>
    </div>
  );
}
