"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import { formatAddress } from "@/utils/format";
import { Market } from "@/data/whisk/getMarket";
import Image from "next/image";
import { getAddress } from "viem";
import TotalSupplyWithCap from "../TotalSupplyWithCap";
import NumberFlow from "../ui/NumberFlow";

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
      return curator ? formatAddress(getAddress(curator)) : "None";
    },
    meta: {
      tooltip: "The entity responsible for managing the vault's strategy.",
    },
    minSize: 170,
  },
  {
    accessorKey: "marketSupplyShare",
    header: "Supply Share",
    cell: ({ row }) => {
      return <NumberFlow value={row.original.marketSupplyShare} format={{ style: "percent" }} />;
    },
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
      return (
        <TotalSupplyWithCap
          totalSupplyUsd={allocation.position.supplyAssetsUsd}
          supplyCapUsd={allocation.supplyCapUsd}
        />
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
