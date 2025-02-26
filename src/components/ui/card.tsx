import { cn } from "@/utils/shadcn";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[12px] bg-background-secondary", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-[56px] items-center justify-between rounded-t-[12px] bg-background-inverse px-8 font-semibold text-content-secondary paragraph-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-8", className)} {...props} />;
}
