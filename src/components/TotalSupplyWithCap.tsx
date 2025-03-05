import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import PercentRing from "./ui/icons/PercentRing";
import { formatNumber } from "@/utils/format";
import NumberFlow from "./ui/NumberFlow";

interface TotalSupplyWithCapProps {
  totalSupplyUsd: number;
  supplyCapUsd: number | null;
}

export default function TotalSupplyWithCap({ totalSupplyUsd, supplyCapUsd }: TotalSupplyWithCapProps) {
  const percentOfCap = supplyCapUsd ? totalSupplyUsd / supplyCapUsd : 0;

  const items: {
    label: string;
    value: string;
  }[] = [
    {
      label: "Supply Cap",
      value: supplyCapUsd != null ? formatNumber(supplyCapUsd ?? 0, { currency: "USD" }) : "None",
    },
    {
      label: "Total Supplied",
      value: formatNumber(totalSupplyUsd ?? 0, { currency: "USD" }),
    },
  ];

  const remainingCapacityUsd = supplyCapUsd ? supplyCapUsd - totalSupplyUsd : Infinity;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex items-center gap-2">
          <NumberFlow value={totalSupplyUsd} format={{ currency: "USD" }} />
          <PercentRing percent={percentOfCap} />
        </TooltipTrigger>
        <TooltipContent className="flex w-[320px] flex-col gap-4">
          <div className="label-md flex gap-2">
            <span>Total Supply</span>
            <span className="text-content-secondary">•</span>
            <span className="flex gap-2 text-content-secondary">
              Usage: {formatNumber(percentOfCap, { style: "percent" })}
            </span>
            <PercentRing percent={percentOfCap} />
          </div>
          <p className="text-content-secondary paragraph-sm">
            To mitigate risk, vaults curators can set a market supply cap.
          </p>
          <div className="flex flex-col gap-2 paragraph-sm">
            {items.map((item, i) => (
              <div className="flex items-center justify-between" key={i}>
                <span>{item.label}</span>
                <span className="label-sm">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="h-[1px] w-full bg-border-primary" />
          <div className="label-md flex items-center justify-between">
            <span>Remaining Capacity</span>
            <span>{supplyCapUsd == null ? "∞" : formatNumber(remainingCapacityUsd, { currency: "USD" })}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
