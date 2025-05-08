"use client";
import { motion } from "motion/react";
import { HTMLAttributes } from "react";

import { cn } from "@/utils/shadcn";

interface PercentBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0->1 (will saturate these)
  indicatorClassName?: string;
}

export default function PercentBar({ value, indicatorClassName, className, ...props }: PercentBarProps) {
  const saturatedValue = Math.max(Math.min(value, 1), 0);
  return (
    <div
      className={cn("relative flex h-[10px] w-full items-center gap-1 overflow-hidden rounded-full", className)}
      {...props}
    >
      <div className="h-full w-full bg-white/50" />

      <motion.div
        className={cn("absolute inset-0 bg-accent-primary transition-colors", indicatorClassName)}
        initial={{ x: `-${100}%` }}
        animate={{ x: `-${(1 - saturatedValue) * 100}%` }}
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      />
    </div>
  );
}
