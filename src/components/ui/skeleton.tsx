import { ComponentProps } from "react";

import { cn } from "@/utils/shadcn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-content-secondary/15", className)} {...props} />;
}

function Skeletons({ count, ...props }: { count: number } & ComponentProps<typeof Skeleton>) {
  return Array(count)
    .fill(0)
    .map((_, i) => <Skeleton key={i} {...props} />);
}

export { Skeleton, Skeletons };
