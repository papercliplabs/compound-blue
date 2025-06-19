"use client";
import clsx from "clsx";
import { ReactNode, useMemo } from "react";

import { MetricWithTooltip } from "@/components/Metric";
import NumberFlow, { NumberFlowWithLoading } from "@/components/ui/NumberFlow";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { useAccountMarketPositionAggregate } from "@/hooks/useAccountMarketPosition";

interface BorrowSummaryMetricsProps {
  marketSummaries: MarketSummary[];
}

function MetricSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={clsx("mt-[2px] h-[34px]", className)} {...props} />;
}

export function BorrowSummaryMetrics({ marketSummaries }: BorrowSummaryMetricsProps) {
  const { data: accountMarketPositonAggregate, isLoading } = useAccountMarketPositionAggregate();

  const borrowSummaryMetrics = useMemo(() => {
    return {
      totalBorrowedUsd: marketSummaries.reduce((acc, summary) => acc + (summary.borrowAssetsUsd ?? 0), 0),
      userBorrowsUsd: accountMarketPositonAggregate?.totalBorrowUsd,
      userBorrowApy: accountMarketPositonAggregate?.avgApy,
    };
  }, [marketSummaries, accountMarketPositonAggregate]);

  return (
    <BorrowSummaryMetricsLayout
      totalBorrowed={
        <NumberFlow value={borrowSummaryMetrics.totalBorrowedUsd} format={{ currency: "USD" }} className="title-3" />
      }
      userBorrowed={
        <NumberFlowWithLoading
          isLoading={isLoading}
          loadingContent={<MetricSkeleton className="w-[90px]" />}
          value={borrowSummaryMetrics.userBorrowsUsd}
          format={{ currency: "USD" }}
          className="title-3"
        />
      }
      userBorrowApy={
        <NumberFlowWithLoading
          isLoading={isLoading}
          loadingContent={<MetricSkeleton className="w-[90px]" />}
          value={borrowSummaryMetrics.userBorrowApy}
          format={{ style: "percent" }}
          className="title-3"
        />
      }
    />
  );
}

export function BorrowSummaryMetricsSkeleton() {
  return (
    <BorrowSummaryMetricsLayout
      totalBorrowed={<MetricSkeleton className="w-[104px]" />}
      userBorrowed={<MetricSkeleton className="w-[90px]" />}
      userBorrowApy={<MetricSkeleton className="w-[90px]" />}
    />
  );
}

interface BorrowSummaryMetricsLayoutProps {
  totalBorrowed: ReactNode;
  userBorrowed: ReactNode;
  userBorrowApy: ReactNode;
}

function BorrowSummaryMetricsLayout({ totalBorrowed, userBorrowed, userBorrowApy }: BorrowSummaryMetricsLayoutProps) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row">
      <div className="flex gap-8">
        <MetricWithTooltip
          className="flex-1"
          label="Total borrowed"
          tooltip="The total amount of loan assets borrowed from all markets in the table."
        >
          {totalBorrowed}
        </MetricWithTooltip>
      </div>
      <div className="flex gap-8">
        <MetricWithTooltip
          label={<span className="justify-end text-accent-ternary">Your Borrowing</span>}
          tooltip="Sum of your borrows across all markets in the table."
          className="flex-1 md:items-end"
        >
          {userBorrowed}
        </MetricWithTooltip>
        <MetricWithTooltip
          label="Your borrow APY"
          tooltip="Your net borrow APY across all markets in the table."
          className="flex-1 md:items-end"
        >
          {userBorrowApy}
        </MetricWithTooltip>
      </div>
    </div>
  );
}
