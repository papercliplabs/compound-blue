import { formatNumber } from "@/utils/format";
import Image from "next/image";
import { ReactNode } from "react";

interface ApyBreakdownProps {
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
}

export default function ApyBreakdown({ base, rewards, performanceFee, total }: ApyBreakdownProps) {
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
                  {formatNumber(performanceFee, { style: "percent", minimumFractionDigits: 0 })}
                </div>
              </div>
            ),
            apy: performanceFee,
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
