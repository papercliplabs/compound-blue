"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import { formatAddress } from "@/utils/format";
import { Market } from "@/data/whisk/getMarket";
import { getAddress } from "viem";
import TotalSupplyWithCap from "../TotalSupplyWithCap";
import NumberFlow from "../ui/NumberFlow";
import { VaultIdentifier } from "../VaultIdentifier";

interface TableProps {
  allocations: Market["vaultAllocations"];
}

export const columns: ColumnDef<Market["vaultAllocations"][number]>[] = [
  {
    accessorKey: "vault.name",
    header: "Vault",
    cell: ({ row }) => {
      const vault = row.original.vault;
      return <VaultIdentifier name={vault.name} metadata={vault.metadata} asset={vault.asset} />;
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
      rowAction={(row) => ({ type: "link", href: `/${row.vault.vaultAddress}` })}
    />
  );
}
