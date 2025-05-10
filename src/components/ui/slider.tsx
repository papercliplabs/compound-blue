"use client";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/utils/shadcn";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  supply?: boolean;
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, supply, ...props }, ref) => {
    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex w-full cursor-pointer touch-none select-none items-center py-2 [&[data-disabled]]:cursor-auto",
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-content-secondary">
          <SliderPrimitive.Range
            className={cn("absolute h-full", supply ? "bg-accent-secondary" : "bg-accent-ternary")}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="group relative block flex h-4 w-4 items-center justify-center focus-visible:outline-none [&[data-disabled]]:opacity-50">
          <div className="relative z-50 h-full w-full rounded-full bg-content-primary shadow" />
          <div className="z-1 absolute h-full w-full scale-0 rounded-full bg-content-secondary/40 transition group-hover:scale-150 group-focus:scale-150 group-[&[data-disabled]]:scale-0" />
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Root>
    );
  }
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
