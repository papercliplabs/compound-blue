import { type VariantProps, cva } from "class-variance-authority";
import clsx from "clsx";
import * as React from "react";

import { cn } from "@/utils/shadcn";

const inputVariants = cva(
  clsx(
    "flex w-full rounded-md bg-transparent px-0 py-1 transition-colors placeholder:text-content-secondary aria-invalid:text-semantic-negative",
    "file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "focus-visible:ring-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
  ),
  {
    variants: {
      variant: {
        primary: "",
      },
      size: {
        lg: "!font-medium title-2",
        md: "label-lg",
        sm: "paragraph-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "lg",
    },
  }
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

function Input({ className, type, size, ...props }: InputProps) {
  return <input type={type} className={cn(inputVariants({ size, className }))} {...props} />;
}

function NumberInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      placeholder="0"
      inputMode="decimal"
      type="text"
      className={clsx("w-full border p-2", className)}
      {...props}
      // Override the onChange to prevent non-numeric characters
      onChange={(e) => {
        const value = e.target.value;
        if (/^0*(\d+)?(\.\d*)?$/.test(value)) {
          props.onChange?.(e);
        }
      }}
    />
  );
}

export { Input, NumberInput };
