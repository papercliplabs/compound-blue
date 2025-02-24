"use client";
import { ColumnDef, SortingState, getSortedRowModel, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { Table } from "../ui/Table";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import Image from "next/image";
import { formatNumber } from "@/utils/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import Sparkle from "../ui/icons/Sparkle";
import ApyBreakdown from "../ApyBreakdown";

interface TableProps {
  marketSummaries: MarketSummary[];
}

export const columns: ColumnDef<MarketSummary>[] = [
  {
    accessorKey: "loanAsset.symbol",
    header: "Loan",
    cell: ({ row }) => {
      const market = row.original;

      return (
        <div className="flex items-center gap-3">
          <Image
            src={market.loanAsset.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={market.loanAsset.symbol}
          />
          <span>{market.loanAsset.symbol}</span>
        </div>
      );
    },
  },
  // TODO: add connected wallet borrow amount
  {
    accessorKey: "collateralAsset.symbol",
    header: "Collateral",
    cell: ({ row }) => {
      const market = row.original;

      return market.collateralAsset ? (
        <div className="flex items-center gap-3">
          <Image
            src={market.collateralAsset.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={market.collateralAsset.symbol}
          />
          <span>{market.collateralAsset.symbol}</span>
        </div>
      ) : (
        "N/A"
      );
    },
  },
  {
    accessorKey: "liquidityAssetsUsd",
    header: "Liquidity",
    accessorFn: (row) => formatNumber(row.liquidityAssetsUsd, { currency: "USD" }),
  },
  {
    accessorKey: "utilization",
    header: "Utilization",
    accessorFn: (row) => formatNumber(row.utilization, { style: "percent" }),
  },
  {
    accessorKey: "lltv",
    header: "LLTV",
    accessorFn: (row) => formatNumber(row.lltv, { style: "percent" }),
  },
  {
    accessorKey: "borrowApy.total",
    header: "Borrow APY",
    cell: ({ row }) => {
      const market = row.original;
      const rewards = market.borrowApy.rewards;

      return rewards.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-2">
              {formatNumber(market.borrowApy.total, { style: "percent" })}
              <Sparkle className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent className="flex max-w-[320px] flex-col gap-4">
              <div className="font-semibold">Borrow APY</div>
              <div className="font-medium text-content-primary/50 paragraph-sm">
                The annual percent yield (APY) paid by borrowing from this market.
              </div>
              <ApyBreakdown {...market.borrowApy} />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div>{formatNumber(market.borrowApy.total, { style: "percent" })}</div>
      );
    },
  },
];

export default function BorrowTableTable({ marketSummaries }: TableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "liquidityAssetsUsd",
      desc: true,
    },
  ]);

  const table = useReactTable({
    data: marketSummaries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return <Table table={table} rowLink={(row) => `/borrow/${row.marketId}`} />;
}
