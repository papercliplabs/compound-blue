"use client";
import clsx from "clsx";
import { Info } from "lucide-react";
import { motion } from "motion/react";

import { capitalizeFirstLetter } from "@/utils/format";
import { computeLtvHealth } from "@/utils/ltv";

import NumberFlow from "./ui/NumberFlow";
import PercentBar from "./ui/PercentBar";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";

interface LtvBarProps {
  ltv: number;
  lltv?: number;
}

export default function LtvBar({ ltv, lltv }: LtvBarProps) {
  const ltvHealth = computeLtvHealth(ltv, lltv);
  const ltvSaturated = Math.max(Math.min(ltv, 1), 0);
  return (
    <div className="flex h-[65px] flex-col gap-2">
      <div className="flex justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-content-secondary">LTV</span>{" "}
          <NumberFlow value={ltvSaturated} format={{ style: "percent", minimumFractionDigits: 0 }} />
        </div>

        <div className="flex items-center gap-1">
          <span
            className={clsx({
              "text-semantic-positive": ltvHealth === "healthy",
              "text-semantic-warning": ltvHealth === "warning",
              "text-semantic-negative": ltvHealth === "unhealthy",
            })}
          >
            {capitalizeFirstLetter(ltvHealth)}
          </span>
          <TooltipPopover>
            <TooltipPopoverTrigger>
              <Info size={14} className="stroke-content-secondary" />
            </TooltipPopoverTrigger>
            <TooltipPopoverContent>
              Your Loan-to-Value (LTV) is the ratio of your loan amount to the value of your collateral. For monolithic
              protocols like AAVE, this includes your total loan, and total collateral amount across all supplied and
              borrowed assets. If your LTV exceeds the market&apos;s Liquidation Loan-to-Value (LLTV), your position
              becomes unhealthy and eligible for liquidation.
            </TooltipPopoverContent>
          </TooltipPopover>
        </div>
      </div>
      <div className="relative">
        <PercentBar
          value={ltv}
          className="bg-sem"
          indicatorClassName={clsx({
            "bg-semantic-positive": ltvHealth === "healthy",
            "bg-semantic-warning": ltvHealth === "warning",
            "bg-semantic-negative": ltvHealth === "unhealthy",
          })}
        />
        {lltv && (
          <div className="mt-[-12px]">
            <motion.div
              className="flex flex-col gap-1"
              animate={{ x: `${lltv * 100}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              <div className="h-[16px] w-[4px] rounded-full bg-content-primary" />
              <div className="w-fit -translate-x-1/2 text-content-secondary paragraph-sm">
                LLTV: <NumberFlow value={lltv} format={{ style: "percent", minimumFractionDigits: 0 }} />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
