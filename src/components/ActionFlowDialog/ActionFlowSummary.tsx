"use client";
import { HTMLAttributes, useMemo } from "react";
import { useActionFlowContext } from "./ActionFlowProvider";
import { cn } from "@/utils/shadcn";
import Image from "next/image";
import { formatNumber } from "@/utils/format";
import clsx from "clsx";

export function ActionFlowSummary({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { flowState } = useActionFlowContext();
  const hidden = useMemo(() => flowState == "success" || flowState == "failed", [flowState]);

  return (
    <div className={clsx("border-b pb-6", hidden && "hidden")}>
      <div
        className={cn("flex flex-col gap-6 rounded-[10px] bg-background-secondary px-4 py-3 font-semibold", className)}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

interface ActionFlowSummaryAssetItemProps extends HTMLAttributes<HTMLDivElement> {
  asset: {
    symbol: string;
    icon?: string | null;
  };
  actionName: string; // Ex. Supply
  descaledAmount: number;
  amountUsd?: number;
}

export function ActionFlowSummaryAssetItem({
  asset,
  actionName,
  descaledAmount,
  amountUsd,
  className,
  ...props
}: ActionFlowSummaryAssetItemProps) {
  return (
    <div className={cn("flex w-full items-center justify-between gap-3 font-semibold", className)} {...props}>
      <div className="flex items-center gap-2">
        {asset.icon && <Image src={asset.icon} width={32} height={32} alt={asset.symbol} className="rounded-full" />}
        <span>
          {actionName} {asset.symbol}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span>{formatNumber(descaledAmount)}</span>
        {amountUsd && (
          <span className="text-content-secondary paragraph-sm">{formatNumber(amountUsd, { currency: "USD" })}</span>
        )}
      </div>
    </div>
  );
}
