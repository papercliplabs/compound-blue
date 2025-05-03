"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import Image from "next/image";
import NumberFlow from "../ui/NumberFlow";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import Apy from "../Apy";
import { VaultMigrationTableEntry } from "@/hooks/useVaultMigrationTableData";

interface TableProps {
  data: VaultMigrationTableEntry[];
  onRowClick: (entry: VaultMigrationTableEntry) => void;
}

const columns: ColumnDef<VaultMigrationTableEntry>[] = [
  {
    accessorKey: "vaultSummary.asset.symbol",
    header: "Asset",
    cell: ({ row }) => {
      const { destinationVaultSummary } = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src={destinationVaultSummary.asset.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={destinationVaultSummary.asset.symbol}
          />
          <div className="flex flex-col justify-between">
            <span className="label-lg">{destinationVaultSummary.asset.symbol}</span>
          </div>
        </div>
      );
    },
    minSize: 160,
  },
  {
    id: "balance",
    accessorKey: "reservePosition.aTokenAssetsUsd",
    header: "Balance",
    cell: ({ row }) => {
      return <NumberFlow value={row.original.sourcePosition.aTokenAssetsUsd} format={{ currency: "USD" }} />;
    },
    meta: {
      tooltip: "Your asset balance inside the other protocol.",
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
    accessorKey: "vaultSummary.supplyApy.total",
    header: "Earn APY Change",
    cell: ({ row }) => {
      const { sourcePosition, destinationVaultSummary } = row.original;
      return (
        <div className="flex items-center gap-1">
          <NumberFlow
            value={sourcePosition.reserve.supplyApy.total}
            format={{ style: "percent" }}
            className="text-content-secondary"
          />
          <ArrowRight size={13} className="stroke-content-secondary" />
          <Apy type="supply" apy={destinationVaultSummary.supplyApy} />
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
          <Button size="md">
            <div>Migrate</div>
          </Button>
        </div>
      );
    },
    minSize: 140,
  },
];

export default function VaultMigrationTable({ data, onRowClick }: TableProps) {
  return (
    <Table
      columns={columns}
      data={data}
      initialSort={[{ id: "balance", desc: true }]}
      rowAction={(row) => ({
        type: "callback",
        callback: () => {
          onRowClick(row);
        },
      })}
    />
  );
}
