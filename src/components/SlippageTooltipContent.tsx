import { ReactNode } from "react";

interface SlippageTooltipContentProps {
  items: { name: string; value: ReactNode }[];
  isEstimate?: boolean;
}

export function SlippageTooltipContent({ items, isEstimate }: SlippageTooltipContentProps) {
  return (
    <div className="flex flex-col gap-2 text-content-secondary paragraph-sm">
      <p className="text-content-primary label-md">Max Slippage</p>
      <p>
        Higher slippages increase success rates but may result in worse prices, while lower slippages ensure better
        prices but may cause transactions to fail.
      </p>
      <p>Below are the {isEstimate && "estimated "}worst-case values based on the slippage you&apos;ve set.</p>
      <div className="flex flex-col gap-2 rounded-[8px] bg-background-inverse p-2 text-content-secondary">
        {items.map((item, i) => (
          <div className="flex items-center justify-between gap-2 label-sm" key={i}>
            <span>{item.name}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
