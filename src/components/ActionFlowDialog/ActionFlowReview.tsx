"use client";
import { HTMLAttributes, useMemo } from "react";
import { useActionFlowContext } from "./ActionFlowProvider";
import { cn } from "@/utils/shadcn";

export function ActionFlowReview({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { flowState } = useActionFlowContext();
  const hidden = useMemo(() => flowState != "review", [flowState]);

  return (
    <div className={cn("flex flex-col gap-4", hidden && "!hidden", className)} {...props}>
      {children}
    </div>
  );
}
