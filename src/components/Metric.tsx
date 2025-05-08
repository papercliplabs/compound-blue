import { ReactNode } from "react";

import { cn } from "@/utils/shadcn";

import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";

export type MetricProps = {
  label: ReactNode;
  children: ReactNode;
} & React.ComponentProps<"div">;

export type MetricWithTooltipProps = {
  tooltip: ReactNode;
} & MetricProps;

export function MetricWithTooltip({ label, children, tooltip, className, ...props }: MetricWithTooltipProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      <TooltipPopover>
        <TooltipPopoverTrigger>
          <Metric label={label} className={className}>
            {children}
          </Metric>
        </TooltipPopoverTrigger>
        <TooltipPopoverContent>{tooltip}</TooltipPopoverContent>
      </TooltipPopover>
    </div>
  );
}

export function Metric({ label, children, className, ...props }: MetricProps) {
  return (
    <div className={cn("flex flex-col gap-1 text-left text-content-primary", className)} {...props}>
      <p className="w-fit whitespace-nowrap text-content-secondary label-md">{label}</p>
      {children}
    </div>
  );
}
