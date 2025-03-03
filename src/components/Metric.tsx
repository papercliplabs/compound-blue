import { cn } from "@/utils/shadcn";
import { HTMLAttributes, ReactNode } from "react";
import { TooltipPopover, TooltipPopoverTrigger, TooltipPopoverContent } from "./ui/tooltipPopover";

export interface MetricProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  description: string;
  children: ReactNode;
}

export default function Metric({ label, description, children, className, ...props }: MetricProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      <TooltipPopover>
        <TooltipPopoverTrigger className="label-md w-fit whitespace-nowrap text-content-secondary">
          {label}
        </TooltipPopoverTrigger>
        <TooltipPopoverContent>{description}</TooltipPopoverContent>
      </TooltipPopover>
      {children}
    </div>
  );
}
