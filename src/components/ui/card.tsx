import { HTMLAttributes } from "react";

import { cn } from "@/utils/shadcn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[12px] bg-background-secondary", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "label-md flex h-[56px] items-center justify-between rounded-t-[12px] bg-background-inverse px-8 text-content-secondary",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-8", className)} {...props} />;
}
