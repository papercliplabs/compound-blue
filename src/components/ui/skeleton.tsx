import { cn } from "@/utils/shadcn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-background-secondary", className)} {...props} />;
}

export { Skeleton };
