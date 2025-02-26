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
            <span>{vault.name}</span>
            <span className="font-semibold text-content-secondary paragraph-sm">{vault.asset.symbol}</span>
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
    minSize: 170,
  },
  {
    accessorKey: "marketSupplyShare",
    header: "Supply Share",
    accessorFn: (row) => formatNumber(row.marketSupplyShare, { style: "percent" }),
    minSize: 150,
  },
  {
    accessorKey: "position.supplyAssetsUsd",
    header: "Total Supply",
    cell: ({ row }) => {
      const allocation = row.original;
      const percentOfCap = allocation.position.supplyAssetsUsd / allocation.supplyCapUsd;
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
    minSize: 140,
  },
];

export default function VaultAllocationTable({ allocations }: TableProps) {
  return <Table columns={columns} data={allocations} rowLink={(row) => `/earn/${row.vault.vaultAddress}`} />;
}
