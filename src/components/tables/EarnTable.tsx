"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { formatNumber } from "@/utils/format";
import Apy from "../Apy";
import RowIcons from "../RowIcons";
import { NumberFlowWithLoading } from "../ui/NumberFlow";
import { VaultIdentifier } from "../VaultIdentifier";
import { Skeleton } from "../ui/skeleton";
import clsx from "clsx";
import { EarnTableEntry, useEarnTableData } from "@/hooks/useEarnTableData";

interface TableProps {
  vaultSummaries: VaultSummary[];
}

export const columns: ColumnDef<EarnTableEntry>[] = [
  {
    accessorKey: "name",
    header: "Vault Name",
    cell: ({ row }) => {
      const { vaultSummary } = row.original;
      return <VaultIdentifier name={vaultSummary.name} metadata={vaultSummary.metadata} asset={vaultSummary.asset} />;
    },
    minSize: 240,
  },
  {
    id: "userDepositsUsd",
    accessorFn: (row) => row.position?.supplyAssetsUsd ?? 0,
    header: "Your Deposits",
    cell: ({ row }) => {
      const { position, isPositionLoading } = row.original;
      return (
        <NumberFlowWithLoading
          value={position?.supplyAssetsUsd}
          format={{ currency: "USD" }}
          isLoading={isPositionLoading}
          loadingContent={<Skeleton className="h-[24px] w-[60px]" />}
          className={clsx(position?.supplyAssetsUsd == 0 && "text-content-secondary")}
        />
      );
    },
    minSize: 160,
  },
  {
    accessorKey: "supplyAssetsUsd",
    header: "Total Deposits",
    cell: ({ row }) => formatNumber(row.original.vaultSummary.supplyAssetsUsd, { currency: "USD" }),
    meta: {
      tooltip: "The total assets deposited.",
    },
    minSize: 160,
  },
  {
    accessorKey: "liquidityAssetsUsd",
    header: "Liquidity",
    cell: ({ row }) => formatNumber(row.original.vaultSummary.liquidityAssetsUsd, { currency: "USD" }),
    minSize: 120,
    meta: {
      tooltip: "The available assets to be withdrawn or reallocated.",
    },
  },
  {
    accessorKey: "marketAllocations",
    header: "Collateral",
    cell: ({ row }) => {
      const { vaultSummary } = row.original;
      return (
        <RowIcons
          icons={vaultSummary.marketAllocations
            .filter((allocation) => allocation.market.collateralAsset)
            .map((allocation) => ({
              src: allocation.market.collateralAsset!.icon ?? "",
              alt: allocation.market.collateralAsset!.symbol,
            }))}
          size={24}
        />
      );
    },
    meta: {
      tooltip: "The collateral asset exposure through market allocations.",
    },
    sortingFn: (rowA, rowB) =>
      rowA.original.vaultSummary.marketAllocations.length - rowB.original.vaultSummary.marketAllocations.length,
    minSize: 160,
  },
  {
    accessorKey: "supplyApy.total",
    header: "Supply APY",
    cell: ({ row }) => {
      const { vaultSummary } = row.original;
      return <Apy type="supply" apy={vaultSummary.supplyApy} />;
    },
    meta: {
      tooltip: "The total supply APY including rewards and fees.",
    },
    minSize: 130,
  },
];

export default function EarnTable({ vaultSummaries }: TableProps) {
  const earnTableData = useEarnTableData({ vaultSummaries });
  return (
    <Table
      columns={columns}
      data={earnTableData}
      initialSort={[
        { id: "userDepositsUsd", desc: true },
        { id: "supplyAssetsUsd", desc: true },
      ]}
      rowAction={(row) => ({ type: "link", href: `/${row.vaultSummary.vaultAddress}` })}
    />
  );
}
