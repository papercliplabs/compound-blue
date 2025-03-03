"use client";
import { ColumnDef } from "@tanstack/react-table";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import Image from "next/image";
import { formatNumber } from "@/utils/format";
import { Table } from "./Table";
import Apy from "../Apy";
import { useMemo } from "react";
import NumberFlow from "../ui/NumberFlow";
import { useAccountMarketPositions } from "@/hooks/useAccountMarketPosition";

interface TableProps {
  marketSummaries: MarketSummary[];
}

export const columns: ColumnDef<MarketSummary & { userBorrowUsd: number; userLtv: number }>[] = [
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
          <span className="label-lg">{market.loanAsset.symbol}</span>
        </div>
      );
    },
    meta: {
      tooltip: "The borrowable asset.",
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
          <span className="label-lg">{market.collateralAsset.symbol}</span>
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
    accessorKey: "userBorrowUsd",
    header: "Your Borrow",
    cell: ({ row }) => {
      return <NumberFlow value={row.original.userBorrowUsd} format={{ currency: "USD" }} />;
    },
    minSize: 160,
  },
  {
    accessorKey: "lltv",
    header: "Your LTV / LLTV",
    cell: ({ row }) => {
      const market = row.original;
      return (
        <span>
          <NumberFlow value={row.original.userLtv} format={{ style: "percent", minimumFractionDigits: 1 }} /> /{" "}
          {formatNumber(market.lltv, { style: "percent", minimumFractionDigits: 1 })}
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
    header: "Liquidity",
    accessorFn: (row) => formatNumber(row.liquidityAssetsUsd, { currency: "USD" }),
    minSize: 140,
    meta: {
      tooltip: "The total assets available to be borrowed, including via public reallocation.",
    },
  },
  {
    accessorKey: "borrowApy.total",
    header: "Borrow APY",
    cell: ({ row }) => {
      const market = row.original;
      return <Apy type="borrow" apy={market.borrowApy} />;
    },
    meta: {
      tooltip: "The total borrow APY including rewards.",
    },
    minSize: 140,
  },
];

export default function BorrowTableClient({ marketSummaries }: TableProps) {
  // Inject user position
  const { data: accountMarketPositions } = useAccountMarketPositions();

  const marketSummariesWithUserPositions = useMemo(() => {
    return marketSummaries.map((market) => {
      const userBorrowUsd = accountMarketPositions?.[market.marketId]?.borrowAssetsUsd ?? 0;
      const userLtv = accountMarketPositions?.[market.marketId]?.ltv ?? 0;
      return { ...market, userBorrowUsd, userLtv };
    });
  }, [marketSummaries, accountMarketPositions]);

  return (
    <Table
      columns={columns}
      data={marketSummariesWithUserPositions}
      initialSortKey="liquidityAssetsUsd"
      rowLink={(row) => `/borrow/${row.marketId}`}
    />
  );
}
