import * as React from "react";

import { cn } from "@/utils/shadcn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "aria-invalid:text-semantic-negative flex w-full rounded-md bg-transparent px-0 py-1 !font-medium transition-colors title-2 placeholder:text-content-secondary",
          "file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus-visible:ring-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
