"use client";
import { ColumnDef, SortingState, getSortedRowModel, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { Table } from "../ui/Table";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import Image from "next/image";
import { formatNumber } from "@/utils/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import Sparkle from "../ui/icons/Sparkle";
import ApyBreakdown from "../ApyBreakdown";

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
            width={36}
            height={36}
            className="shrink-0 rounded-full border"
            alt={vault.name}
          />
          <div className="flex flex-col justify-between">
            <span>{vault.name}</span>
            <span className="font-semibold text-content-secondary paragraph-sm">{vault.asset.symbol}</span>
          </div>
        </div>
      );
    },
    minSize: 240,
  },
  // TODO: add connected wallet position
  // {
  //   accessorKey: "",
  //   header: "Your Deposits",
  //   accessorFn: (row) => formatNumber(row.supplyAssetsUsd, { currency: "USD" }),
  // },
  {
    accessorKey: "supplyAssetsUsd",
    header: "Total Deposits",
    accessorFn: (row) => formatNumber(row.supplyAssetsUsd, { currency: "USD" }),
  },
  {
    accessorKey: "liquidityAssetsUsd",
    header: "Liqudity",
    accessorFn: (row) => formatNumber(row.liquidityAssetsUsd, { currency: "USD" }),
  },
  {
    accessorKey: "marketAllocations",
    header: "Collateral",
    cell: ({ row }) => {
      const vault = row.original;

      // TODO: limit this with a +N button, and dedupe the icons
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
  {
    accessorKey: "supplyApy.total",
    header: "Supply APY",
    cell: ({ row }) => {
      const vault = row.original;
      const rewards = vault.supplyApy.rewards;

      return rewards.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-2">
              {formatNumber(vault.supplyApy.total, { style: "percent" })}
              <Sparkle className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent className="flex max-w-[320px] flex-col gap-4">
              <div className="font-semibold">Supply APY</div>
              <div className="font-medium text-content-primary/50 paragraph-sm">
                The annual percent yield (APY) earned by depositing into this vault.
              </div>
              <ApyBreakdown {...vault.supplyApy} />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div>{formatNumber(vault.supplyApy.total, { style: "percent" })}</div>
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
