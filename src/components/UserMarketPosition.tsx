"use client";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { Hex } from "viem";
import { useUserMarketPosition, useUserPositionContext } from "@/providers/UserPositionProvider";
import { ReactNode, useMemo } from "react";
import { Skeleton } from "./ui/skeleton";
import Metric from "./Metric";
import { useAccount } from "wagmi";
import Image from "next/image";
import NumberFlow from "./ui/NumberFlow";
import Apy from "./Apy";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";
import { MAX_BORROW_LTV_MARGIN } from "@/config";
import { MarketNonIdle } from "@/data/whisk/getMarket";
import { MarketId } from "@morpho-org/blue-sdk";

interface MarketPositionProps {
  market: MarketNonIdle;
}

export function UserMarketPosition({ market }: MarketPositionProps) {
  const { data: marketPosition, isLoading } = useUserMarketPosition(market.marketId as MarketId);

  const items: { label: string; description: string; value: ReactNode }[] = [
    {
      label: `Collateral (${market.collateralAsset.symbol})`,
      description: "Your position's collateral balance.",
      value: <NumberFlow value={marketPosition?.collateralAssetsUsd ?? 0} format={{ currency: "USD" }} />,
    },
    {
      label: `Loan (${market.loanAsset.symbol})`,
      description: "Your positions borrow balance.",
      value: <NumberFlow value={marketPosition?.borrowAssetsUsd ?? 0} format={{ currency: "USD" }} />,
    },
    {
      label: "Available to Borrow",
      description: `The additional amount your position is able to borrow from the market. This will provide a LTV with a ${formatNumber(MAX_BORROW_LTV_MARGIN, { style: "percent" })} margin below the market's LLTV.`,
      value: (
        <NumberFlow
          value={Math.max((marketPosition?.maxBorrowAssetsUsd ?? 0) - (marketPosition?.borrowAssetsUsd ?? 0), 0)}
          format={{ currency: "USD" }}
        />
      ),
    },
    {
      label: "Loan to value",
      description:
        "The current loan to value (LTV) of your position. If this exceeds the liqudation loan to value (LLTV) you will be liquidated.",
      value: (
        <>
          <NumberFlow value={marketPosition?.ltv ?? 0} format={{ style: "percent" }} /> /{" "}
          {formatNumber(marketPosition?.market?.lltv ?? 0, { style: "percent" })}
        </>
      ),
    },
    {
      label: "APY",
      description:
        "The current borrow APY of your position including rewards. This will equal the market's borrow APY.",
      value: <Apy type="supply" apy={market.borrowApy} className="gap-1" />,
    },
  ];

  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="flex w-full justify-between font-semibold">
          <TooltipPopover>
            <TooltipPopoverTrigger>{item.label}</TooltipPopoverTrigger>
            <TooltipPopoverContent>{item.description}</TooltipPopoverContent>
          </TooltipPopover>
          <span>{isLoading ? <Skeleton className="h-5 w-12" /> : item.value}</span>
        </div>
      ))}
    </>
  );
}

export function UserMarketPositionHighlight({ marketId }: { marketId: Hex }) {
  const { address } = useAccount();
  const { data: marketPosition } = useUserMarketPosition(marketId);

  // Hide if not connected
  if (!address || !marketPosition || !marketPosition.market) {
    return null;
  }

  return (
    <div className="flex flex-col md:items-end md:text-end">
      <Metric
        label={<span className="justify-end text-accent-ternary">Borrowing</span>}
        description="Your borrow balance in this market."
      >
        <span className="title-3">
          <NumberFlow value={marketPosition.borrowAssetsUsd} format={{ currency: "USD" }} />
        </span>
      </Metric>
      <div className="flex items-center gap-1 font-semibold text-content-secondary paragraph-sm">
        {marketPosition.market.loanAsset.icon && (
          <Image
            src={marketPosition.market.loanAsset.icon}
            width={12}
            height={12}
            alt={marketPosition.market.loanAsset.symbol}
            className="rounded-full"
          />
        )}
        <NumberFlow
          value={descaleBigIntToNumber(BigInt(marketPosition.borrowAssets), marketPosition.market.loanAsset.decimals)}
        />
      </div>
    </div>
  );
}

export function UserMarketPositionAggregate() {
  const { address } = useAccount();
  const {
    userMarketPositionsQuery: { data: userMarketPositions },
  } = useUserPositionContext();

  const { totalBorrowUsd, avgApy } = useMemo(() => {
    const { totalBorrowUsd, avgApy } = Object.values(userMarketPositions ?? {}).reduce(
      (acc, marketPosition) => {
        return {
          totalBorrowUsd: acc.totalBorrowUsd + marketPosition.borrowAssetsUsd,
          avgApy: acc.avgApy + (marketPosition.market?.borrowApy.total ?? 0) * marketPosition.borrowAssetsUsd,
        };
      },
      { totalBorrowUsd: 0, avgApy: 0 }
    );

    return {
      totalBorrowUsd,
      avgApy: totalBorrowUsd > 0 ? avgApy / totalBorrowUsd : 0,
    };
  }, [userMarketPositions]);

  // Hide if not connected
  if (!address) {
    return null;
  }

  return (
    <div className="flex gap-10 md:text-end">
      <Metric
        label={<span className="justify-end text-accent-ternary">Your Borrowing</span>}
        description="Your total borrow balance across all markets."
      >
        <span className="title-3">
          <NumberFlow value={totalBorrowUsd} format={{ currency: "USD" }} />
        </span>
      </Metric>

      <Metric
        label={<span className="justify-end">Avg. Borrow APY</span>}
        description="Your average borrow APY across all markets, including rewards."
      >
        <span className="title-3">
          <NumberFlow value={avgApy} format={{ style: "percent" }} />
        </span>
      </Metric>
    </div>
  );
}
