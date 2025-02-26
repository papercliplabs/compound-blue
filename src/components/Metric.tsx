import { cn } from "@/utils/shadcn";
import { HTMLAttributes, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export interface MetricProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  description: string;
  children: ReactNode;
}

export default function Metric({ label, description, children, className, ...props }: MetricProps) {
  // TODO: popover on mobile
  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="w-fit whitespace-nowrap font-semibold text-content-secondary">
            {label}
          </TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {children}
    </div>
  );
}
