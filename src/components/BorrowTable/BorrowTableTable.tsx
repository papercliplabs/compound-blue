"use client";
import { ColumnDef, SortingState, getSortedRowModel, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { Table } from "../ui/Table";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";

interface TableProps {
  marketSummaries: MarketSummary[];
}

export const columns: ColumnDef<MarketSummary>[] = [
  {
    accessorKey: "collateralAsset.symbol",
    header: "Collateral",
    // cell: ({ row }) => {
    //   const vault = row.original;

    //   return (
    //     <div className="flex min-w-0 items-center gap-3">
    //       <Image
    //         src={vault.underlyingAsset?.icon ?? ""}
    //         width={24}
    //         height={24}
    //         className="border-border-secondary h-6 w-6 shrink-0 rounded-full border"
    //         alt={vault.underlyingAsset?.symbol ?? "Unknown token"}
    //         data-categories="essential"
    //       />
    //       <div className="flex min-w-0 flex-col">
    //         <span className="text-foreground-secondary overflow-hidden overflow-ellipsis">{vault.name}</span>
    //         <span className="label-sm">{vault.underlyingAsset?.symbol}</span>
    //       </div>
    //     </div>
    //   );
    // },
    minSize: 240,
  },
  {
    accessorKey: "loanAsset.symbol",
    header: "Loan",
  },
];

export default function BorrowTableTable({ marketSummaries }: TableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    // {
    //   id: "loanAsset",
    //   desc: true,
    // },
  ]);

  const table = useReactTable({
    data: marketSummaries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return <Table table={table} rowLink={(row) => `/borrow/${row.marketId}`} />;
}
