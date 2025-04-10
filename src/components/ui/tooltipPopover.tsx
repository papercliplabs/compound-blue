"use client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useResponsiveContext } from "@/providers/ResponsiveProvider";
import { ButtonHTMLAttributes, HTMLAttributes } from "react";

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

export function TooltipPopoverTrigger(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isDesktop } = useResponsiveContext();
  return isDesktop ? <TooltipTrigger type="button" {...props} /> : <PopoverTrigger type="button" {...props} />;
}

export function TooltipPopoverContent(props: HTMLAttributes<HTMLDivElement>) {
  const { isDesktop } = useResponsiveContext();
  return isDesktop ? <TooltipContent {...props} /> : <PopoverContent {...props} />;
}
