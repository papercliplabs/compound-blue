"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Vault } from "@/data/whisk/getVault";
import { Table } from "./Table";
import TotalSupplyWithCap from "../TotalSupplyWithCap";
import NumberFlow from "../ui/NumberFlow";
import { MarketIdentifier } from "../MarketIdentifier";

interface TableProps {
  allocations: Vault["marketAllocations"];
}

export const columns: ColumnDef<Vault["marketAllocations"][number]>[] = [
  {
    accessorKey: "market.name",
    header: "Market",
    cell: ({ row }) => {
      const market = row.original.market;
      return <MarketIdentifier {...market} />;
    },
    minSize: 280,
  },
  {
    accessorKey: "vaultSupplyShare",
    header: "Allocation",
    meta: {
      tooltip: "The percentage of the vault's supply that is allocated to this market.",
    },
    cell: ({ row }) => {
      return <NumberFlow value={row.original.vaultSupplyShare} format={{ style: "percent" }} />;
    },
    minSize: 130,
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
      tooltip: "The total amount of assets supplied to this market.",
    },
    minSize: 150,
  },
  {
    accessorKey: "market.supplyApy.total",
    header: "Supply APY",
    cell: ({ row }) => {
      return <NumberFlow value={row.original.market.supplyApy.total} format={{ style: "percent" }} />;
    },
    meta: {
      tooltip: "The supply APY earned by the vault for it's position in this market.",
    },
    minSize: 130,
  },
];

export default function MarketAllocationTable({ allocations }: TableProps) {
  return (
    <Table
      columns={columns}
      data={allocations}
      initialSortKey="vaultSupplyShare"
      rowAction={(row) => (row.market.isIdle ? null : { type: "link", href: `/borrow/${row.market.marketId}` })} // No link for idle markets
    />
  );
}
