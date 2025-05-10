"use client";
import { ColumnDef } from "@tanstack/react-table";
import clsx from "clsx";
import Image from "next/image";

import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { BorrowTableEntry, useBorrowTableData } from "@/hooks/useBorrowTableData";
import { formatNumber } from "@/utils/format";

import Apy from "../Apy";
import MarketAvailableLiquidity from "../MarketAvailableLiquidity";
import { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";

import { Table } from "./Table";

interface TableProps {
  marketSummaries: MarketSummary[];
}

export const columns: ColumnDef<BorrowTableEntry>[] = [
  {
    accessorKey: "marketSummary.collateralAsset.symbol",
    header: "Collateral Asset",
    cell: ({ row }) => {
      const { marketSummary } = row.original;

      return marketSummary.collateralAsset ? (
        <div className="flex items-center gap-3">
          <Image
            src={marketSummary.collateralAsset.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={marketSummary.collateralAsset.symbol}
          />
          <span className="label-lg">{marketSummary.collateralAsset.symbol}</span>
        </div>
      ) : (
        "N/A"
      );
    },
    meta: {
      tooltip: "The asset used as collateral for loans.",
    },
    minSize: 160,
  },
  {
    accessorKey: "marketSummary.loanAsset.symbol",
    header: "Loan Asset",
    cell: ({ row }) => {
      const { marketSummary } = row.original;

      return (
        <div className="flex items-center gap-3">
          <Image
            src={marketSummary.loanAsset.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={marketSummary.loanAsset.symbol}
          />
          <span className="label-lg">{marketSummary.loanAsset.symbol}</span>
        </div>
      );
    },
    meta: {
      tooltip: "The borrowable asset.",
    },
    minSize: 160,
  },
  {
    id: "userBorrowUsd",
    accessorFn: (row) => row.position?.borrowAssetsUsd ?? 0,
    header: "Your Borrow",
    cell: ({ row }) => {
      const { position, isPositionLoading } = row.original;
      return (
        <NumberFlowWithLoading
          value={position?.borrowAssetsUsd}
          format={{ currency: "USD" }}
          isLoading={isPositionLoading}
          loadingContent={<Skeleton className="h-[24px] w-[60px]" />}
          className={clsx(position?.borrowAssetsUsd == 0 && "text-content-secondary")}
        />
      );
    },
    minSize: 160,
  },
  {
    accessorKey: "position.ltv",
    header: "Your LTV / LLTV",
    cell: ({ row }) => {
      const { marketSummary, position, isPositionLoading } = row.original;
      return (
        <span className="flex items-center gap-1">
          <NumberFlowWithLoading
            value={position?.ltv}
            format={{ style: "percent", minimumFractionDigits: 1 }}
            isLoading={isPositionLoading}
            loadingContent={<Skeleton className="h-[24px] w-[60px]" />}
            className={clsx(position?.ltv == 0 && "text-content-secondary")}
          />{" "}
          / {formatNumber(marketSummary.lltv, { style: "percent", minimumFractionDigits: 1 })}
        </span>
      );
    },
    meta: {
      tooltip: "Your loan to value (LTV), versus the market's liquidation loan to value (LLTV) threshold.",
    },
    minSize: 160,
  },
  {
    accessorKey: "liquidityAssetsUsd",
    accessorFn: (row) =>
      row.marketSummary.liquidityAssetsUsd + row.marketSummary.publicAllocatorSharedLiquidityAssetsUsd,
    header: "Liquidity",
    cell: ({ row }) => {
      const { marketSummary } = row.original;
      return (
        <MarketAvailableLiquidity
          liquidityAssetUsd={marketSummary.liquidityAssetsUsd}
          publicAllocatorSharedLiquidityAssetsUsd={marketSummary.publicAllocatorSharedLiquidityAssetsUsd}
        />
      );
    },
    meta: {
      tooltip: "The total assets available to be borrowed, including via public reallocation.",
    },
    minSize: 140,
  },
  {
    accessorKey: "marketSummary.borrowApy.total",
    header: "Borrow APY",
    cell: ({ row }) => {
      const { marketSummary } = row.original;
      return <Apy type="borrow" apy={marketSummary.borrowApy} />;
    },
    meta: {
      tooltip: "The total borrow APY including rewards.",
    },
    minSize: 140,
  },
];

export default function BorrowTable({ marketSummaries }: TableProps) {
  const borrowTableData = useBorrowTableData({ marketSummaries });
  return (
    <Table
      columns={columns}
      data={borrowTableData}
      initialSort={[
        { id: "userBorrowUsd", desc: true },
        { id: "liquidityAssetsUsd", desc: true },
      ]}
      rowAction={(row) => ({ type: "link", href: `/borrow/${row.marketSummary.marketId}` })}
    />
  );
}
