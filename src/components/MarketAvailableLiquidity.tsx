import { ComponentProps } from "react";

import { formatNumber } from "@/utils/format";

import NumberFlow from "./ui/NumberFlow";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";

type MarketAvailableLiquidityProps = {
  liquidityAssetUsd: number;
  publicAllocatorSharedLiquidityAssetsUsd: number;
  showTooltip?: boolean;
} & React.ComponentProps<"div">;

type MarketAvailableLiquidityItem = {
  label: string;
  value: string;
};

type MarketAvailableLiquidityTooltipProps = {
  liquidityAssetUsd: number;
  publicAllocatorSharedLiquidityAssetsUsd: number;
};

type MarketAvailableLiquidityTriggerProps = {
  total: number;
} & ComponentProps<typeof NumberFlow>;

export default function MarketAvailableLiquidity({
  className,
  liquidityAssetUsd,
  publicAllocatorSharedLiquidityAssetsUsd,
  showTooltip = true,
}: MarketAvailableLiquidityProps) {
  const total = liquidityAssetUsd + publicAllocatorSharedLiquidityAssetsUsd;

  return showTooltip ? (
    <TooltipPopover>
      <TooltipPopoverTrigger>
        <MarketAvailableLiquidityTrigger className={className} total={total} />
      </TooltipPopoverTrigger>
      <TooltipPopoverContent className="w-[320px]">
        <MarketAvailableLiquidityTooltip
          liquidityAssetUsd={liquidityAssetUsd}
          publicAllocatorSharedLiquidityAssetsUsd={publicAllocatorSharedLiquidityAssetsUsd}
        />
      </TooltipPopoverContent>
    </TooltipPopover>
  ) : (
    <MarketAvailableLiquidityTrigger className={className} total={total} />
  );
}

function MarketAvailableLiquidityTrigger({ total, ...props }: MarketAvailableLiquidityTriggerProps) {
  return <NumberFlow value={total} format={{ currency: "USD" }} {...props} />;
}

export function MarketAvailableLiquidityTooltip({
  liquidityAssetUsd,
  publicAllocatorSharedLiquidityAssetsUsd,
}: MarketAvailableLiquidityTooltipProps) {
  const items: MarketAvailableLiquidityItem[] = [
    {
      label: "Liquidity in Market",
      value: formatNumber(liquidityAssetUsd, { currency: "USD" }),
    },
    {
      label: "Liquidity via Public Allocator",
      value: formatNumber(publicAllocatorSharedLiquidityAssetsUsd, { currency: "USD" }),
    },
  ];

  const total = liquidityAssetUsd + publicAllocatorSharedLiquidityAssetsUsd;

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}
