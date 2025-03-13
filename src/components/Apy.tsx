import { formatNumber } from "@/utils/format";
import Image from "next/image";
import { HTMLAttributes, ReactNode } from "react";
import Sparkle from "./ui/icons/Sparkle";
import { cn } from "@/utils/shadcn";
import { TooltipPopover, TooltipPopoverTrigger, TooltipPopoverContent } from "./ui/tooltipPopover";
import NumberFlow from "./ui/NumberFlow";

interface ApyProps extends HTMLAttributes<HTMLDivElement> {
  type: "supply" | "borrow";
  apy: {
    base: number;
    rewards: {
      asset: {
        symbol: string;
        icon?: string | null;
      };
      apr: number;
    }[];
    performanceFee?: number;
    total: number;
  };
}

const APY_TOOLTIP_CONTENT: Record<ApyProps["type"], { title: string; description: string }> = {
  supply: {
    title: "Supply APY",
    description: "The annual percent yield (APY) earned by depositing into this vault.",
  },
  borrow: {
    title: "Borrow APY",
    description: "The annual percent yield (APY) paid by borrowing from this market.",
  },
};

export default function Apy({ type, apy, className }: ApyProps) {
  if (apy.rewards.length == 0) {
    return formatNumber(apy.total, { style: "percent" });
  }

  return (
    <TooltipPopover>
      <TooltipPopoverTrigger className={cn("flex items-center gap-2", className)}>
        <NumberFlow value={apy.total} format={{ style: "percent" }} />
        <Sparkle className="h-5 w-5" />
      </TooltipPopoverTrigger>
      <TooltipPopoverContent className="flex max-w-[320px] flex-col gap-4">
        <div className="label-md">{APY_TOOLTIP_CONTENT[type].title}</div>
        <div className="text-content-primary/50 paragraph-sm">{APY_TOOLTIP_CONTENT[type].description}</div>
        <ApyBreakdown {...apy} />
      </TooltipPopoverContent>
    </TooltipPopover>
  );
}

function ApyBreakdown({ base, rewards, performanceFee, total }: ApyProps["apy"]) {
  const items: { yieldSource: ReactNode; apy: number }[] = [
    { yieldSource: "Native APY", apy: base },
    ...rewards.map((reward) => ({
      yieldSource: (
        <div className="flex items-center gap-2">
          <span>{reward.asset.symbol}</span>
          {reward.asset.icon && (
            <Image src={reward.asset.icon} width={20} height={20} alt={reward.asset.symbol} className="rounded-full" />
          )}
        </div>
      ),
      apy: reward.apr,
    })),
    ...(performanceFee != undefined
      ? [
          {
            yieldSource: (
              <div className="flex items-center gap-2">
                <span>Performance Fee</span>
                <div className="rounded-[4px] bg-button-neutral px-1 font-semibold">
                  {formatNumber(base > 0 ? performanceFee / base : 0, {
                    style: "percent",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1,
                  })}
                </div>
              </div>
            ),
            apy: -performanceFee, // Negative to show as a subtraction
          },
        ]
      : []),
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-2">
        {items.map((item, i) => (
          <div className="flex w-full items-center justify-between" key={i}>
            <div className="text-content-secondary">{item.yieldSource}</div>
            <span className="font-semibold">
              {formatNumber(item.apy, { style: "percent", signDisplay: "exceptZero" })}
            </span>
          </div>
        ))}
      </div>
      <div className="h-[1px] w-full bg-border-primary" />
      <div className="flex w-full items-center justify-between font-semibold paragraph-md">
        <div>Total APY</div>
        <span className="font-semibold">= {formatNumber(total, { style: "percent" })}</span>
      </div>
    </div>
  );
}
