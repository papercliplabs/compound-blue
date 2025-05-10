"use client";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { MarketMigrationTableEntry } from "@/hooks/useMarketMigrationTableData";

import Apy from "../Apy";
import { Button } from "../ui/button";
import NumberFlow from "../ui/NumberFlow";

import { Table } from "./Table";

interface TableProps {
  data: MarketMigrationTableEntry[];
  onRowClick: (entry: MarketMigrationTableEntry) => void;
}

const columns: ColumnDef<MarketMigrationTableEntry>[] = [
  {
    accessorKey: "destinationMarketPosition.market.loanAsset.symbol",
    header: "Loan",
    cell: ({ row }) => {
      const { destinationMarketSummary } = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src={destinationMarketSummary.loanAsset.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={destinationMarketSummary.loanAsset.symbol}
          />
          <div className="flex flex-col justify-between">
            <span className="label-lg">{destinationMarketSummary.loanAsset.symbol}</span>
          </div>
        </div>
      );
    },
    minSize: 160,
  },
  {
    accessorKey: "destinationMarketPosition.market.collateralAsset.symbol",
    header: "Collateral",
    cell: ({ row }) => {
      const { destinationMarketSummary } = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src={destinationMarketSummary.collateralAsset!.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={destinationMarketSummary.collateralAsset!.symbol}
          />
          <div className="flex flex-col justify-between">
            <span className="label-lg">{destinationMarketSummary.collateralAsset!.symbol}</span>
          </div>
        </div>
      );
    },
    minSize: 160,
  },
  {
    accessorKey: "aaveV3LoanReservePosition.borrowAssetsUsd",
    header: "Collateral Balance",
    cell: ({ row }) => {
      return (
        <NumberFlow value={row.original.aaveV3CollateralReservePosition.aTokenAssetsUsd} format={{ currency: "USD" }} />
      );
    },
    meta: {
      tooltip: "Your collateral balance inside the other protocol.",
    },
    minSize: 150,
  },
  {
    id: "loan-balance",
    accessorKey: "aaveV3LoanReservePosition.aTokenAssetsUsd",
    header: "Loan Balance",
    cell: ({ row }) => {
      return <NumberFlow value={row.original.aaveV3LoanReservePosition.borrowAssetsUsd} format={{ currency: "USD" }} />;
    },
    meta: {
      tooltip: "Your loan balance inside the other protocol.",
    },
    minSize: 150,
  },
  {
    id: "protocol",
    header: "Protocol",
    cell: ({}) => {
      return (
        <div className="flex items-center gap-2">
          <Image
            src="/aave.png"
            width={20}
            height={20}
            className="aspect-square h-[20px] w-[20px] rounded-full"
            alt="Aave"
          />
          <span>AAVE v3</span>
        </div>
      );
    },
    meta: {
      tooltip: "The protocol you have a migratable position in.",
    },
    minSize: 160,
  },
  {
    accessorKey: "destinationMarketPosition.market.borrowApy.total",
    header: "Borrow APY Change",
    cell: ({ row }) => {
      const { destinationMarketSummary, aaveV3LoanReservePosition } = row.original;
      return (
        <div className="flex items-center gap-1">
          <NumberFlow
            value={aaveV3LoanReservePosition.reserve.borrowApy.total}
            format={{ style: "percent" }}
            className="text-content-secondary"
          />
          <ArrowRight size={13} className="stroke-content-secondary" />
          <Apy type="supply" apy={destinationMarketSummary.borrowApy} />
        </div>
      );
    },
    meta: {
      tooltip: "Net earn APY in your current position, compared to what you could earn on Compound Blue.",
    },
    minSize: 190,
  },
  {
    id: "action",
    enableSorting: false,
    cell: () => {
      return (
        <div className="flex w-full items-center justify-end">
          <Button size="md" variant="borrow">
            <div>Migrate</div>
          </Button>
        </div>
      );
    },
    minSize: 140,
  },
];

export default function MarketMigrationTable({ data, onRowClick }: TableProps) {
  return (
    <Table
      columns={columns}
      data={data}
      initialSort={[{ id: "loan-balance", desc: true }]}
      rowAction={(row) => ({
        type: "callback",
        callback: () => {
          onRowClick(row);
        },
      })}
    />
  );
}
