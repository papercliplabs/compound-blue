"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Vault } from "@/data/whisk/getVault";
import { Table } from "./Table";
import { formatNumber } from "@/utils/format";
import clsx from "clsx";
import PercentRing from "../ui/icons/PercentRing";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import MarketIcon from "../MarketIcon";

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
    accessorFn: (row) => formatNumber(row.vaultSupplyShare, { style: "percent" }),
    meta: {
      tooltip: "The percentage of the vault's supply that is allocated to this market.",
    },
    minSize: 130,
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
              {formatNumber(allocation.supplyCapUsd, { currency: "USD" })} supply cap.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
    accessorFn: (row) => formatNumber(row.market.supplyApy.total, { style: "percent" }),
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
