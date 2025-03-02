"use client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useResponsiveContext } from "@/providers/ResponsiveProvider";
import { HTMLAttributes } from "react";

export function TooltipPopover({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useResponsiveContext();

  return isDesktop ? (
    <TooltipProvider>
      <Tooltip>{children}</Tooltip>
    </TooltipProvider>
  ) : (
    <Popover>{children}</Popover>
  );
}

export function TooltipPopoverTrigger(props: HTMLAttributes<HTMLButtonElement>) {
  const { isDesktop } = useResponsiveContext();
  return isDesktop ? <TooltipTrigger {...props} /> : <PopoverTrigger {...props} />;
}

export function TooltipPopoverContent(props: HTMLAttributes<HTMLDivElement>) {
  const { isDesktop } = useResponsiveContext();
  return isDesktop ? <TooltipContent {...props} /> : <PopoverContent {...props} />;
}
