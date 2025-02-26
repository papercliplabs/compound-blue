"use client";
import { cn } from "@/utils/shadcn";
import { ColumnDef, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { ComponentProps, HTMLAttributes, HTMLProps, useEffect, useRef, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { ScrollSync, ScrollSyncPane } from "react-scroll-sync";
import SortIcon from "../ui/icons/Sort";
import { HEADER_HEIGHT } from "../Header";

export function TableRow({ className, ...props }: HTMLProps<HTMLDivElement>) {
  return <div className={cn("flex w-full min-w-fit items-center", className)} {...props} />;
}

export function TableRowLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn("flex w-full min-w-fit items-center", className)} {...props} />;
}

export interface TableCellProps extends HTMLAttributes<HTMLDivElement> {
  minWidth?: number;
}

export function TableCell({ minWidth, className, style, ...props }: TableCellProps) {
  // shrink first col on mobile to allow more table to be displayed in resting position
  return (
    <div
      className={cn(
        "flex h-full w-[0px] flex-1 shrink-0 grow items-center overflow-hidden text-ellipsis text-nowrap px-4",
        className
      )}
      style={{
        minWidth,
        ...style,
      }}
      {...props}
    />
  );
}

interface TableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  initialSortKey?: string;
  rowLink: (row: TData) => string;
}

export function Table<TData, TValue>({ columns, data, initialSortKey, rowLink }: TableProps<TData, TValue>) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([
    ...(initialSortKey
      ? [
          {
            id: initialSortKey,
            desc: true,
          },
        ]
      : []),
  ]);

  // Scroll to top of the table on sort change if its above the header
  useEffect(() => {
    const tableTop = (tableRef.current?.getBoundingClientRect().top ?? 0) + 18; // Accounts for top padding and small overlap
    if (tableTop < HEADER_HEIGHT) {
      window.scrollTo({ top: window.scrollY + (tableTop - HEADER_HEIGHT), behavior: "smooth" });
    }
  }, [sorting]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <ScrollSync>
      <div className="relative h-fit min-w-0 grow py-4" ref={tableRef}>
        <div className="sticky z-[5] min-w-full" style={{ top: HEADER_HEIGHT - 2 }}>
          <ScrollSyncPane>
            <div className="scrollbar-none overflow-auto overscroll-x-none bg-background-secondary px-4">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="h-12 font-semibold text-content-secondary">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableCell
                        minWidth={header.column.columnDef.minSize}
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className="h-12 select-none items-center hover:cursor-pointer"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon state={header.column.getIsSorted()} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </div>
          </ScrollSyncPane>
        </div>
        <ScrollSyncPane>
          <div className="scrollbar-none flex w-full flex-col overflow-x-auto overscroll-x-none rounded-b-[12px] px-4 font-semibold paragraph-lg">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRowLink
                  href={rowLink(row.original)}
                  className="group h-16 gap-0 transition-colors last:rounded-b-[12px] hover:bg-background-inverse"
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      minWidth={cell.column.columnDef.minSize}
                      key={cell.id}
                      // className={clsx(cell.column.getIsSorted() && "bg-background-inverse")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRowLink>
              ))
            ) : (
              <div className="flex h-[100px] flex-col items-center justify-center gap-1">
                <span>No items :(.</span>
              </div>
            )}
          </div>
        </ScrollSyncPane>
      </div>
    </ScrollSync>
  );
}
