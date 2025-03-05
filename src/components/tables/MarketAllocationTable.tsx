"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Vault } from "@/data/whisk/getVault";
import { Table } from "./Table";
import { formatNumber } from "@/utils/format";
import clsx from "clsx";
import MarketIcon from "../MarketIcon";
import TotalSupplyWithCap from "../TotalSupplyWithCap";
import NumberFlow from "../ui/NumberFlow";

interface TableProps {
  allocations: Vault["marketAllocations"];
}

export const columns: ColumnDef<Vault["marketAllocations"][number]>[] = [
  {
    accessorKey: "market.name",
    header: "Market",
    cell: ({ row }) => {
      const market = row.original.market;

      return (
        <div className="flex items-center gap-3">
          <MarketIcon loanAssetInfo={market.loanAsset} collateralAssetInfo={market.collateralAsset ?? undefined} />
          <div className={clsx("flex items-center gap-2", !market.collateralAsset?.icon && "pl-[32px]")}>
            <span className="label-lg">{market.name}</span>
            <div className="label-sm rounded-[4px] bg-button-neutral px-1 text-content-secondary">
              {formatNumber(market.lltv, { style: "percent", minimumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      );
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
      rowLink={(row) => (row.market.isIdle ? null : `/borrow/${row.market.marketId}`)} // No link for idle markets
    />
  );
}
