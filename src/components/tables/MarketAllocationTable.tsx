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
            <span>{market.name}</span>
            <div className="rounded-[4px] bg-button-neutral px-1 text-content-secondary paragraph-sm">
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
    minSize: 130,
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
    minSize: 150,
  },
  {
    accessorKey: "market.supplyApy.total",
    header: "Supply APY",
    accessorFn: (row) => formatNumber(row.market.supplyApy.total, { style: "percent" }),
    minSize: 130,
  },
];

export default function MarketAllocationTable({ allocations }: TableProps) {
  return <Table columns={columns} data={allocations} rowLink={(row) => `/borrow/${row.market.marketId}`} />;
}
