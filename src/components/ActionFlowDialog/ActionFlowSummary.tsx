"use client";
import clsx from "clsx";
import { CircleMinus, CirclePlus } from "lucide-react";
import Image from "next/image";
import { HTMLAttributes, useMemo } from "react";

import { calculateUsdValue, descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { cn } from "@/utils/shadcn";

import { useActionFlowContext } from "./ActionFlowProvider";

export function ActionFlowSummary({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { flowState } = useActionFlowContext();
  const hidden = useMemo(() => flowState == "success" || flowState == "failed", [flowState]);

  return (
    <div className={clsx("border-b pb-6", hidden && "hidden")}>
      <div className={cn("flex flex-col gap-6 rounded-[10px] bg-background-secondary px-4 py-3", className)} {...props}>
        {children}
      </div>
    </div>
  );
}

interface ActionFlowSummaryAssetItemProps extends HTMLAttributes<HTMLDivElement> {
  asset: {
    symbol: string;
    decimals: number;
    icon?: string | null;
    priceUsd?: number | null;
  };
  actionName: string; // Ex. Supply
  side: "supply" | "borrow";
  isIncreasing: boolean;
  rawAmount: bigint;
  protocolName?: string;
}

export function ActionFlowSummaryAssetItem({
  asset,
  actionName,
  side,
  isIncreasing,
  rawAmount,
  protocolName,
  className,
  ...props
}: ActionFlowSummaryAssetItemProps) {
  return (
    <div className={cn("flex w-full items-center justify-between gap-3 label-md", className)} {...props}>
      <div className="flex items-center gap-3">
        {asset.icon && (
          <div className="relative">
            <Image src={asset.icon} width={32} height={32} alt={asset.symbol} className="rounded-full" />
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 rounded-full bg-background-primary">
              {isIncreasing ? (
                <CirclePlus
                  className={clsx("h-4 w-4 shrink-0 border-none stroke-background-primary", {
                    "fill-accent-secondary": side == "supply",
                    "fill-accent-ternary": side == "borrow",
                  })}
                />
              ) : (
                <CircleMinus
                  className={clsx("h-4 w-4 shrink-0 border-none stroke-background-primary", {
                    "fill-accent-secondary": side == "supply",
                    "fill-accent-ternary": side == "borrow",
                  })}
                />
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col justify-between">
          <span>
            {actionName} {asset.symbol}
          </span>
          {protocolName && <span className="text-content-secondary label-sm">{protocolName}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span>{formatNumber(descaleBigIntToNumber(rawAmount, asset.decimals))}</span>
        {asset.priceUsd && (
          <span className="text-content-secondary label-sm">
            {formatNumber(calculateUsdValue(rawAmount, asset.decimals, asset.priceUsd), { currency: "USD" })}
          </span>
        )}
      </div>
    </div>
  );
}
