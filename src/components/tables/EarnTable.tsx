"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Table } from "./Table";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import Image from "next/image";
import { formatNumber } from "@/utils/format";
import Apy from "../Apy";
import RowIcons from "../RowIcons";
import { useMemo } from "react";
import { getAddress } from "viem";
import NumberFlow from "../ui/NumberFlow";
import { useAccountVaultPositions } from "@/hooks/useAccountVaultPosition";

interface TableProps {
  vaultSummaries: VaultSummary[];
}

export const columns: ColumnDef<VaultSummary & { userDepositsUsd: number }>[] = [
  {
    accessorKey: "name",
    header: "Vault Name",
    cell: ({ row }) => {
      const vault = row.original;

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
            <div className="flex">
              <span className="label-sm text-content-secondary">{vault.asset.symbol}</span>
              {vault.metadata?.riskTier && (
                <span className="label-sm inline whitespace-pre-wrap text-content-secondary">
                  {" "}
                  • {vault.metadata.riskTier.slice(0, 1).toUpperCase() + vault.metadata.riskTier.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      );
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
      rowLink={(row) => `/earn/${row.vaultAddress}`}
    />
  );
}
