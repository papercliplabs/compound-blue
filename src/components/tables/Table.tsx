"use client";
import { cn } from "@/utils/shadcn";
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  RowData,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { HTMLAttributes, useEffect, useRef, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { ScrollSync, ScrollSyncPane } from "react-scroll-sync";
import SortIcon from "../ui/icons/Sort";
import "@tanstack/react-table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

// Add a tooltip column to meta
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    tooltip?: string;
  }
}

type TableRowAction =
  | {
      type: "link";
      href: string;
    }
  | {
      type: "callback";
      callback: () => void;
    };

export function TableRow({
  action,
  className,
  children,
}: HTMLAttributes<HTMLDivElement> & { action?: TableRowAction }) {
  if (action?.type == "link") {
    return (
      // Annoying hack for the scroll sync to work
      <div className="w-fit min-w-full px-4">
        <Link
          href={action.href}
          className={cn(
            "flex w-full min-w-fit items-center rounded-[8px] transition-colors hover:bg-background-inverse",
            className
          )}
        >
          {children}
        </Link>
      </div>
    );
  } else {
    return (
      // Annoying hack for the scroll sync to work
      <div className="w-fit min-w-full px-4">
        <div
          className={cn(
            "flex w-full min-w-fit items-center rounded-[8px] transition-colors",
            action?.type == "callback" && "hover:cursor-pointer hover:bg-background-inverse",
            className
          )}
          onClick={action?.type == "callback" ? action.callback : undefined}
        >
          {children}
        </div>
      </div>
    );
  }
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
  rowAction: (row: TData) => TableRowAction | null;
}

export function Table<TData, TValue>({ columns, data, initialSortKey, rowAction }: TableProps<TData, TValue>) {
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
    const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-height"));
    if (tableTop < headerHeight) {
      window.scrollTo({ top: window.scrollY + (tableTop - headerHeight), behavior: "smooth" });
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
      <div className="relative h-fit min-w-0 grow overflow-x-visible pt-4" ref={tableRef}>
        {/* Gradients on left and right for mobile */}
        <div className="absolute bottom-0 left-0 top-0 z-[10] w-8 rounded-bl-[12px] bg-gradient-to-r from-background-secondary to-transparent md:hidden" />
        <div className="absolute bottom-0 right-0 top-0 z-[10] w-8 rounded-br-[12px] bg-gradient-to-l from-background-secondary to-transparent md:hidden" />

        <div className="sticky top-[calc(var(--header-height)-2px)] z-[5] min-w-full">
          <ScrollSyncPane>
            <div className="overflow-auto overscroll-x-none bg-background-secondary scrollbar-none">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="h-12 text-content-secondary label-sm">
                  {headerGroup.headers.map((header) => {
                    const cellContent = (
                      <div className="flex h-12 select-none items-center hover:cursor-pointer">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.columnDef.enableSorting == false ? null : (
                          <SortIcon state={header.column.getIsSorted()} />
                        )}
                      </div>
                    );

                    const tooltip = header.column.columnDef.meta?.tooltip;
                    return (
                      <TableCell
                        minWidth={header.column.columnDef.minSize}
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {tooltip ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>{cellContent}</TooltipTrigger>
                              <TooltipContent>{tooltip}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          cellContent
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </div>
          </ScrollSyncPane>
        </div>
        <ScrollSyncPane>
          <div className="flex w-full flex-col overflow-x-auto overscroll-x-none pb-4 scrollbar-none paragraph-lg">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow action={rowAction(row.original) ?? undefined} className="group h-[72px] gap-0" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell minWidth={cell.column.columnDef.minSize} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <div className="flex h-[100px] flex-col items-center justify-center gap-1 text-content-secondary">
                <span>No items</span>
              </div>
            )}
          </div>
        </ScrollSyncPane>
      </div>
    </ScrollSync>
  );
}
