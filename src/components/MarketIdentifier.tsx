import clsx from "clsx";
import Image from "next/image";
import { HTMLAttributes } from "react";

import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/shadcn";

interface MarketIdentifierProps {
  name: MarketSummary["name"];
  collateralAsset?: MarketSummary["collateralAsset"];
  loanAsset: MarketSummary["loanAsset"];
  lltv: MarketSummary["lltv"];
}

export function MarketIdentifier({ name, collateralAsset, loanAsset, lltv }: MarketIdentifierProps) {
  return (
    <div className="flex items-center gap-3">
      <MarketIcon loanAssetInfo={loanAsset} collateralAssetInfo={collateralAsset ?? undefined} />
      <div className={clsx("flex items-center gap-2", !collateralAsset?.icon && "pl-[32px]")}>
        <span className="label-lg">{name}</span>
        <div className="rounded-[4px] bg-button-neutral px-1 text-content-secondary label-sm">
          {formatNumber(lltv, { style: "percent", minimumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  );
}

interface MarketIconProps extends HTMLAttributes<HTMLDivElement> {
  loanAssetInfo: {
    icon?: string | null;
    symbol: string;
  };
  collateralAssetInfo?: {
    icon?: string | null;
    symbol: string;
  } | null;
}

export function MarketIcon({ loanAssetInfo, collateralAssetInfo, className, ...props }: MarketIconProps) {
  return (
    <div className={"flex items-center"} {...props}>
      {collateralAssetInfo?.icon && (
        <Image
          src={collateralAssetInfo.icon}
          alt={collateralAssetInfo.symbol}
          width={40}
          height={40}
          className={cn("z-[1] rounded-full border-2 border-background-secondary", className)}
        />
      )}
      <div className={clsx("flex items-center gap-3", collateralAssetInfo?.icon && "-ml-[12px]")}>
        {loanAssetInfo?.icon && (
          <Image
            src={loanAssetInfo.icon}
            alt={loanAssetInfo.symbol}
            width={40}
            height={40}
            className={cn("rounded-full border-2 border-background-secondary", className)}
          />
        )}
      </div>
    </div>
  );
}
