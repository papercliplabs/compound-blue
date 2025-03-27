import { formatNumber } from "@/utils/format";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";
import NumberFlow from "./ui/NumberFlow";

interface MarketAvailableLiquidityProps {
  liquidityAssetUsd: number;
  publicAllocatorSharedLiquidityAssetsUsd: number;
}

export default function MarketAvailableLiquidity({
  liquidityAssetUsd,
  publicAllocatorSharedLiquidityAssetsUsd,
}: MarketAvailableLiquidityProps) {
  const total = liquidityAssetUsd + publicAllocatorSharedLiquidityAssetsUsd;

  const items: {
    label: string;
    value: string;
  }[] = [
    {
      label: "Liquidity in Market",
      value: formatNumber(liquidityAssetUsd, { currency: "USD" }),
    },
    {
      label: "Liquidity via Public Allocator",
      value: formatNumber(publicAllocatorSharedLiquidityAssetsUsd, { currency: "USD" }),
    },
  ];

  return (
    <TooltipPopover>
      <TooltipPopoverTrigger>
        <NumberFlow value={total} format={{ currency: "USD" }} />
      </TooltipPopoverTrigger>
      <TooltipPopoverContent className="flex w-[320px] flex-col gap-4">
        <span className="label-md">Market Liquidity</span>
        <p className="text-content-secondary paragraph-sm">
          The total amount of assets available for borrowing, including liquidity that can be reallocated from other
          markets through the public allocator.
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
        <div className="flex items-center justify-between label-md">
          <span>Total Available Liquidity</span>
          <span>{formatNumber(total, { currency: "USD" })}</span>
        </div>
      </TooltipPopoverContent>
    </TooltipPopover>
  );
}
