"use client";
import { cn } from "@/utils/shadcn";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { HTMLAttributes } from "react";
import { ReactNode } from "react";
import { motion } from "motion/react";

interface MetricChangeProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  initialValue: ReactNode;
  finalValue?: ReactNode;
}

export function MetricChange({ name, initialValue, finalValue, className, ...props }: MetricChangeProps) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      <span>{name}</span>
      <motion.div className="flex items-center gap-1 label-md" layout>
        <motion.span
          layout
          className={clsx("transition-colors", finalValue ? "text-content-secondary" : "text-content-primary")}
        >
          {initialValue}
        </motion.span>
        {finalValue && (
          <motion.div
            layout
            className="flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ArrowRight size={14} className="stroke-content-secondary" />
            {finalValue}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
