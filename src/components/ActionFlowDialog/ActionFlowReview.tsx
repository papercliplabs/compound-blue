"use client";
import { HTMLAttributes, useMemo } from "react";
import { useActionFlowContext } from "./ActionFlowProvider";
import { cn } from "@/utils/shadcn";
import { ArrowRight } from "lucide-react";

export function ActionFlowReview({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { flowState } = useActionFlowContext();
  const hidden = useMemo(() => flowState != "review", [flowState]);

  return (
    <div className={cn("flex flex-col gap-4 font-semibold", hidden && "!hidden", className)} {...props}>
      {children}
    </div>
  );
}

interface ActionFlowReviewItemProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  valueBefore: string;
  valueAfter: string;
}

export function ActionFlowReviewItem({
  name,
  valueBefore,
  valueAfter,
  className,
  ...props
}: ActionFlowReviewItemProps) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      <span>{name}</span>
      <div className="flex items-center gap-1">
        <span className="text-content-secondary">{valueBefore}</span>
        <ArrowRight size={14} className="stroke-content-secondary" />
        {valueAfter}
      </div>
    </div>
  );
}
