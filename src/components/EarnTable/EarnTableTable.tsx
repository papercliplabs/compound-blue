"use client";
import { ColumnDef, SortingState, getSortedRowModel, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { Table } from "../ui/Table";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import Image from "next/image";
import { formatNumber } from "@/utils/format";

interface TableProps {
  vaultSummaries: VaultSummary[];
}

export const columns: ColumnDef<VaultSummary>[] = [
  {
    accessorKey: "name",
    header: "Vault Name",
    cell: ({ row }) => {
      const vault = row.original;

      return (
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src={vault.metadata?.image ?? vault.asset.icon ?? ""}
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 rounded-full border"
            alt={vault.name}
          />
          <span>{vault.name}</span>
        </div>
      );
    },
    minSize: 240,
  },
  {
    accessorKey: "liquidityAssetsUsd",
    header: "Liquidity",
    accessorFn: (row) => formatNumber(row.liquidityAssetsUsd, { currency: "USD" }),
  },
  {
    accessorKey: "supplyAssetsUsd",
    header: "Total Supply",
    accessorFn: (row) => formatNumber(row.supplyAssetsUsd, { currency: "USD" }),
  },
  {
    accessorKey: "supplyApy.total",
    header: "Supply APY",
    accessorFn: (row) => formatNumber(row.supplyApy.total, { style: "percent" }),
  },
  {
    accessorKey: "marketAllocations",
    header: "Collateral assets",
    cell: ({ row }) => {
      const vault = row.original;

      return (
        <div className="flex gap-1">
          {vault.marketAllocations
            .filter((allocation) => allocation.market.collateralAsset)
            .map((allocation, i) => (
              <Image
                key={i}
                src={allocation.market.collateralAsset!.icon ?? ""}
                width={24}
                height={24}
                alt={allocation.market.collateralAsset!.symbol}
                className="rounded-full"
              />
            ))}
        </div>
      );
    },
  },
];

export default function EarnTableTable({ vaultSummaries }: TableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "name",
      desc: true,
    },
  ]);

  const table = useReactTable({
    data: vaultSummaries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return <Table table={table} rowLink={(row) => `/earn/${row.vaultAddress}`} />;
}
