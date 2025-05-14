"use client";
import { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";

import { ProtocolMigrationTableEntry } from "@/hooks/useProtocolMigratorTableData";

import RowIcons from "../RowIcons";
import { Button } from "../ui/button";
import NumberFlow from "../ui/NumberFlow";

import { Table } from "./Table";

interface TableProps {
  data: ProtocolMigrationTableEntry[];
}

const columns: ColumnDef<ProtocolMigrationTableEntry>[] = [
  {
    accessorKey: "protocol.name",
    header: "Protocol",
    cell: ({ row }) => {
      const {
        protocol: { icon, name },
      } = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3.5">
          <Image src={icon} width={36} height={36} className="size-9 rounded-[8px]" alt={name} />
          <span className="label-lg">{name}</span>
        </div>
      );
    },
    meta: {
      tooltip: "The protocol to migrate from.",
    },
    minSize: 160,
  },
  {
    accessorKey: "supplyAssets",
    accessorFn: (row) => row.supplyAssets.length,
    header: "Supplying",
    cell: ({ row }) => {
      const { supplyAssets, totalSupplyValueUsd } = row.original;
      return (
        <div className="flex flex-col gap-1">
          <span>
            <NumberFlow value={totalSupplyValueUsd} format={{ currency: "USD" }} />
          </span>
          <RowIcons icons={supplyAssets.map((a) => ({ src: a.icon ?? "", alt: a.symbol }))} size={24} />
        </div>
      );
    },
    meta: {
      tooltip: "Assets supplied within the protocol.",
    },
    minSize: 160,
  },
  {
    accessorKey: "borrowAssets",
    accessorFn: (row) => row.borrowAssets.length,
    header: "Borrowing",
    cell: ({ row }) => {
      const { borrowAssets, totalBorrowValueUsd } = row.original;
      return borrowAssets.length == 0 ? (
        <span className="text-content-secondary">None</span>
      ) : (
        <div className="flex flex-col gap-1">
          <span>
            <NumberFlow value={-totalBorrowValueUsd} format={{ currency: "USD" }} className="text-semantic-negative" />
          </span>
          <RowIcons icons={borrowAssets.map((a) => ({ src: a.icon ?? "", alt: a.symbol }))} size={24} />
        </div>
      );
    },
    meta: {
      tooltip: "Assets borrowed within the protocol.",
    },
    minSize: 160,
  },
  {
    accessorKey: "totalMigratableValueUsd",
    header: "Total Migratable",
    cell: ({ row }) => {
      return (
        <NumberFlow value={row.original.totalMigratableValueUsd} format={{ currency: "USD" }} className="label-lg" />
      );
    },
    meta: {
      tooltip: "Total value that can be migrated (supply - borrow).",
    },
    minSize: 160,
  },
  {
    id: "action",
    enableSorting: false,
    cell: () => {
      return (
        <div className="flex w-full items-center justify-end">
          <Button size="sm">
            <div>Migrate</div>
          </Button>
        </div>
      );
    },
    minSize: 140,
  },
];

export default function ProtocolMigrationTable({ data }: TableProps) {
  return (
    <Table
      columns={columns}
      data={data}
      initialSort={[{ id: "totalMigratableValueUsd", desc: true }]}
      rowAction={(row) => ({
        type: "link",
        href: `/migrate/${row.protocol.key}`,
      })}
    />
  );
}
