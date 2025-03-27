"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { formatNumber } from "@/utils/format";
import Apy from "../Apy";
import RowIcons from "../RowIcons";
import { useMemo } from "react";
import { getAddress } from "viem";
import NumberFlow from "../ui/NumberFlow";
import { useAccountVaultPositions } from "@/hooks/useAccountVaultPosition";
import { VaultIdentifier } from "../VaultIdentifier";

interface TableProps {
  vaultSummaries: VaultSummary[];
}

export const columns: ColumnDef<VaultSummary & { userDepositsUsd: number }>[] = [
  {
    accessorKey: "name",
    header: "Vault Name",
    cell: ({ row }) => {
      const vault = row.original;
      return <VaultIdentifier name={vault.name} metadata={vault.metadata} asset={vault.asset} />;
    },
    minSize: 240,
  },
  {
    accessorKey: "userDepositsUsd",
    header: "Your Deposits",
    cell: ({ row }) => {
      return <NumberFlow value={row.original.userDepositsUsd} format={{ currency: "USD" }} />;
    },
    minSize: 160,
  },
  {
    accessorKey: "supplyAssetsUsd",
    header: "Total Deposits",
    cell: ({ row }) => formatNumber(row.original.supplyAssetsUsd, { currency: "USD" }),
    meta: {
      tooltip: "The total assets deposited.",
    },
    minSize: 160,
  },
  {
    accessorKey: "liquidityAssetsUsd",
    header: "Liquidity",
    cell: ({ row }) => formatNumber(row.original.liquidityAssetsUsd, { currency: "USD" }),
    minSize: 120,
    meta: {
      tooltip: "The available assets to be withdrawn or reallocated.",
    },
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
    meta: {
      tooltip: "The collateral asset exposure through market allocations.",
    },
    sortingFn: (rowA, rowB) => rowA.original.marketAllocations.length - rowB.original.marketAllocations.length,
    minSize: 160,
  },
  {
    accessorKey: "supplyApy.total",
    header: "Supply APY",
    cell: ({ row }) => {
      const vault = row.original;
      return <Apy type="supply" apy={vault.supplyApy} />;
    },
    meta: {
      tooltip: "The total supply APY including rewards and fees.",
    },
    minSize: 130,
  },
];

export default function EarnTable({ vaultSummaries }: TableProps) {
  const { data: accountVaultPositions } = useAccountVaultPositions();

  const vaultSummariesWithUserPositions = useMemo(() => {
    return vaultSummaries.map((vault) => {
      const userDepositsUsd = accountVaultPositions?.[getAddress(vault.vaultAddress)]?.supplyAssetsUsd ?? 0;
      return { ...vault, userDepositsUsd };
    });
  }, [vaultSummaries, accountVaultPositions]);

  return (
    <Table
      columns={columns}
      data={vaultSummariesWithUserPositions}
      initialSortKey="supplyAssetsUsd"
      rowAction={(row) => ({ type: "link", href: `/${row.vaultAddress}` })}
    />
  );
}
