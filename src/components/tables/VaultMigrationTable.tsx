"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import Image from "next/image";
import NumberFlow from "../ui/NumberFlow";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import Apy from "../Apy";
import { MigratableAaveV3SupplyPosition } from "@/hooks/useMigratableAaveV3SupplyPosition";

interface TableProps {
  data: MigratableAaveV3SupplyPosition[];
  onRowClick: (entry: MigratableAaveV3SupplyPosition) => void;
}

const columns: ColumnDef<MigratableAaveV3SupplyPosition>[] = [
  {
    accessorKey: "vaultSummary.asset.symbol",
    header: "Asset",
    cell: ({ row }) => {
      const { destinationVaultPosition } = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src={destinationVaultPosition.asset.icon ?? ""}
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={destinationVaultPosition.asset.symbol}
          />
          <div className="flex flex-col justify-between">
            <span className="label-lg">{destinationVaultPosition.asset.symbol}</span>
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
      return <NumberFlow value={row.original.aaveV3ReservePosition.aTokenAssetsUsd} format={{ currency: "USD" }} />;
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
      const { aaveV3ReservePosition, destinationVaultPosition } = row.original;
      return (
        <div className="flex items-center gap-1">
          <NumberFlow
            value={aaveV3ReservePosition.reserve.supplyApy.total}
            format={{ style: "percent" }}
            className="text-content-secondary"
          />
          <ArrowRight size={13} className="stroke-content-secondary" />
          <Apy type="supply" apy={destinationVaultPosition.supplyApy} />
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
      initialSortKey="balance"
      rowAction={(row) => ({
        type: "callback",
        callback: () => {
          onRowClick(row);
        },
      })}
    />
  );
}
