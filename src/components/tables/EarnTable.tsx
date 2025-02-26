"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import Image from "next/image";
import { formatNumber } from "@/utils/format";
import Apy from "../Apy";
import RowIcons from "../RowIcons";

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
          {/* <div className="absolute left-0 bg-background-secondary pl-4 pr-3 group-hover:bg-background-inverse">
            <Image
              src={vault.metadata?.image ?? vault.asset.icon ?? ""}
              width={36}
              height={36}
              className="shrink-0 rounded-full border"
              alt={vault.name}
            />
          </div>
          <div className="h-1 w-[48px]" />  */}
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
    minSize: 160,
  },
  {
    accessorKey: "liquidityAssetsUsd",
    header: "Liqudity",
    accessorFn: (row) => formatNumber(row.liquidityAssetsUsd, { currency: "USD" }),
    minSize: 120,
  },
  {
    accessorKey: "marketAllocations",
    header: "Collateral",
    cell: ({ row }) => {
      const vault = row.original;
      return (
        <RowIcons
          icons={vault.marketAllocations
            .filter((allocation) => allocation.market.collateralAsset)
            .map((allocation) => ({
              src: allocation.market.collateralAsset!.icon ?? "",
              alt: allocation.market.collateralAsset!.symbol,
            }))}
          size={24}
        />
      );
    },
    minSize: 160,
  },
  {
    accessorKey: "supplyApy.total",
    header: "Supply APY",
    cell: ({ row }) => {
      const vault = row.original;
      return <Apy type="supply" apy={vault.supplyApy} />;
    },
    minSize: 130,
  },
];

export default function EarnTable({ vaultSummaries }: TableProps) {
  return (
    <Table
      columns={columns}
      data={vaultSummaries}
      initialSortKey="supplyAssetsUsd"
      rowLink={(row) => `/earn/${row.vaultAddress}`}
    />
  );
}
