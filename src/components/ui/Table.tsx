"use client";
import { cn } from "@/utils/shadcn";
import { Table as ReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { ComponentProps, HTMLAttributes, HTMLProps } from "react";
import { flexRender } from "@tanstack/react-table";
import { ScrollSync, ScrollSyncPane } from "react-scroll-sync";
import clsx from "clsx";
import SortIcon from "../SortIcon";

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
        "flex h-full w-[0px] flex-1 shrink-0 grow items-center overflow-hidden text-ellipsis text-nowrap px-4 first:pl-6 last:pr-6 sm:max-md:first:!min-w-[200px]",
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

export function Table<T>({ table, rowLink }: { table: ReactTable<T>; rowLink: (row: T) => string }) {
  return (
    <ScrollSync>
      <div className="h-fit min-w-0 grow">
        <div className="sticky top-[64px] z-20 min-w-full">
          <ScrollSyncPane>
            <div className="scrollbar-none overflow-auto overscroll-x-none rounded-t-[16px] border-x border-t">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="h-12">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableCell
                        minWidth={header.column.columnDef.minSize}
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className="h-12 select-none items-center border-b hover:cursor-pointer"
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
          <div className="scrollbar-none flex w-full flex-col overflow-x-auto overscroll-x-none rounded-b-[16px] border-x border-b">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRowLink
                  href={rowLink(row.original)}
                  className="relative h-16 gap-0 last:rounded-b-[16px]"
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      minWidth={cell.column.columnDef.minSize}
                      key={cell.id}
                      className={clsx(cell.column.getIsSorted() && "")}
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
