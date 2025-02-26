"use client";
import { ColumnDef } from "@tanstack/react-table";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import Image from "next/image";
import { formatNumber } from "@/utils/format";
import { Table } from "./Table";
import Apy from "../Apy";

interface TableProps {
  marketSummaries: MarketSummary[];
}

export const columns: ColumnDef<MarketSummary>[] = [
  {
    accessorKey: "loanAsset.symbol",
    header: "Loan Asset",
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
    minSize: 160,
  },
  {
    accessorKey: "collateralAsset.symbol",
    header: "Collateral Asset",
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
    minSize: 160,
  },
  // TODO: add connected wallet borrow amount
  {
    accessorKey: "lltv",
    header: "Your LTV / LLTV",
    cell: ({ row }) => {
      const market = row.original;
      // TODO: add users LTV / LLTV
      return <span>-- / {formatNumber(market.lltv, { style: "percent", minimumFractionDigits: 1 })}</span>;
    },
    minSize: 160,
  },
  {
    accessorKey: "liquidityAssetsUsd",
    header: "Liquidity",
    accessorFn: (row) => formatNumber(row.liquidityAssetsUsd, { currency: "USD" }),
    minSize: 140,
  },
  {
    accessorKey: "borrowApy.total",
    header: "Borrow APY",
    cell: ({ row }) => {
      const market = row.original;
      return <Apy type="borrow" apy={market.borrowApy} />;
    },
    minSize: 140,
  },
];

export default function BorrowTableClient({ marketSummaries }: TableProps) {
  return (
    <Table
      columns={columns}
      data={marketSummaries}
      initialSortKey="liquidityAssetsUsd"
      rowLink={(row) => `/borrow/${row.marketId}`}
    />
  );
}
