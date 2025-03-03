"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import { formatAddress, formatNumber } from "@/utils/format";
import PercentRing from "../ui/icons/PercentRing";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Market } from "@/data/whisk/getMarket";
import Image from "next/image";
import { getAddress } from "viem";

interface TableProps {
  allocations: Market["vaultAllocations"];
}

export const columns: ColumnDef<Market["vaultAllocations"][number]>[] = [
  {
    accessorKey: "vault.name",
    header: "Vault",
    cell: ({ row }) => {
      const vault = row.original.vault;
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
            <span className="label-lg">{vault.name}</span>
            <span className="label-sm text-content-secondary">{vault.asset.symbol}</span>
          </div>
        </div>
      );
    },
    minSize: 280,
  },
  {
    accessorKey: "vault.curatorAddress",
    header: "Curator",
    cell: ({ row }) => {
      const curator = row.original.vault.curatorAddress;
      return curator ? formatAddress(getAddress(curator)) : null;
    },
    meta: {
      tooltip: "The entity responsible for managing the vault's strategy.",
    },
    minSize: 170,
  },
  {
    accessorKey: "marketSupplyShare",
    header: "Supply Share",
    accessorFn: (row) => formatNumber(row.marketSupplyShare, { style: "percent" }),
    meta: {
      tooltip: "The percentage of the market's supply that is from this vault.",
    },
    minSize: 150,
  },
  {
    accessorKey: "position.supplyAssetsUsd",
    header: "Total Supply",
    cell: ({ row }) => {
      const allocation = row.original;
      const percentOfCap = allocation.supplyCapUsd ? allocation.position.supplyAssetsUsd / allocation.supplyCapUsd : 0;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-2">
              {formatNumber(allocation.position.supplyAssetsUsd, { currency: "USD" })}
              <PercentRing percent={percentOfCap} />
            </TooltipTrigger>
            <TooltipContent>
              The current allocation to this market is using {formatNumber(percentOfCap, { style: "percent" })} of the{" "}
              {formatNumber(allocation.position.supplyAssetsUsd, { currency: "USD" })} supply cap.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    meta: {
      tooltip: "The amount of assets supplied to market from this vault.",
    },
    minSize: 140,
  },
];

export default function VaultAllocationTable({ allocations }: TableProps) {
  return (
    <Table
      columns={columns}
      data={allocations}
      initialSortKey="marketSupplyShare"
      rowLink={(row) => `/earn/${row.vault.vaultAddress}`}
    />
  );
}
