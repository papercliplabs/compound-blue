import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/shadcn";
import clsx from "clsx";
import { LoaderCircle } from "lucide-react";

const buttonVariants = cva(
  clsx(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full transition-all",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
  ),
  {
    variants: {
      variant: {
        primary: "bg-button-supply hover:brightness-90 text-white",
        secondary: "bg-button-neutral hover:brightness-90",
        negative: "bg-button-neutral text-semantic-negative hover:brightness-90",
        ghost: "hover:bg-button-neutral",
        none: "hover:brightness-90",
      },
      size: {
        lg: "h-12 px-8 label-md",
        md: "h-11 px-6 label-md",
        sm: "h-7 px-4 label-sm",
        icon: "p-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = {
  asChild?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
} & React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, className, isLoading = false, loadingMessage = "Loading", variant, size, asChild = false, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {isLoading ? (
          <div className="flex items-center gap-1">
            <LoaderCircle className="animate-spin" />
            {loadingMessage}
          </div>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
