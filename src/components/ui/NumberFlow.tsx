"use client";
import NumberFlowReact from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { ComponentProps, ReactNode } from "react";

import { cn } from "@/utils/shadcn";

const MAX_USD_VALUE = 1e12;

type NumberFlowProps = {
  value?: number;
} & Omit<ComponentProps<typeof NumberFlowReact>, "value">;

export default function NumberFlow({ className, format, value, ...props }: NumberFlowProps) {
  if (value == undefined) {
    return <span className={cn("text-content-secondary", className)}>-</span>;
  }

  const currency = format?.currency;
  const isPercent = format?.style === "percent";
  const {
    notation = "compact",
    minimumFractionDigits = 2,
    maximumFractionDigits = value < 1 && currency !== "USD" && !isPercent ? 3 : 2,
    ...restOptions
  } = format ?? {};

  const displayValue = format?.style == "percent" ? value * 100 : value;
  const formatOptions: typeof format = {
    notation: notation == "compact" && (displayValue > 9999 || displayValue < -9999) ? "compact" : "standard",
    minimumFractionDigits,
    maximumFractionDigits,
    style: currency ? "currency" : format?.style,
    ...restOptions,
  };
  let prefix = "";

  // Clamp to max USD value
  if (currency === "USD" && value > MAX_USD_VALUE) {
    value = MAX_USD_VALUE;
    prefix = ">" + prefix;
  }

  const minValue = Math.pow(10, -maximumFractionDigits);
  if (value !== 0 && Math.abs(displayValue) < minValue) {
    const neg = value < 0;
    prefix = neg ? ">" : "<" + prefix;
    value = minValue * Math.pow(10, format?.style === "percent" ? -2 : 0) * (neg ? -1 : 1);
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      {prefix}
      <NumberFlowReact value={value} format={formatOptions} {...props} className="inline-flex items-center" />
    </span>
  );
}

interface NumberFlowWithLoadingProps extends NumberFlowProps {
  isLoading: boolean;
  loadingContent: ReactNode;
}

const crossFadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function NumberFlowWithLoading({ isLoading, loadingContent, ...props }: NumberFlowWithLoadingProps) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        variants={crossFadeVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        key={isLoading ? "loading" : "content"}
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        className="flex items-center"
      >
        {isLoading ? loadingContent : <NumberFlow {...props} />}
      </motion.div>
    </AnimatePresence>
  );
}
