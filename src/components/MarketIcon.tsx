import { cn } from "@/utils/shadcn";
import clsx from "clsx";
import Image from "next/image";
import { HTMLAttributes } from "react";

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

export default function MarketIcon({ loanAssetInfo, collateralAssetInfo, className, ...props }: MarketIconProps) {
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
