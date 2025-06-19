"use client";
import { MarketId } from "@morpho-org/blue-sdk";
import Image from "next/image";
import { ReactNode } from "react";
import { Hex } from "viem";
import { useAccount } from "wagmi";

import { MAX_BORROW_LTV_MARGIN } from "@/config";
import { MarketNonIdle } from "@/data/whisk/getMarket";
import { useAccountMarketPosition, useAccountMarketPositionAggregate } from "@/hooks/useAccountMarketPosition";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { computeMaxBorrowableAssets } from "@/utils/market";

import Apy from "./Apy";
import { MetricWithTooltip } from "./Metric";
import NumberFlow, { NumberFlowWithLoading } from "./ui/NumberFlow";
import { Skeleton } from "./ui/skeleton";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "./ui/tooltipPopover";

interface MarketPositionProps {
  market: MarketNonIdle;
}

export function AccountMarketPosition({ market }: MarketPositionProps) {
  const { data: marketPosition, isLoading } = useAccountMarketPosition(market.marketId as MarketId);

  const collateralAssets = descaleBigIntToNumber(
    marketPosition?.collateralAssets ?? "0",
    market.collateralAsset.decimals
  );
  const borrowAssets = descaleBigIntToNumber(marketPosition?.borrowAssets ?? 0n, market.loanAsset.decimals);
  const rawAvailableToBorrow = computeMaxBorrowableAssets(market, 0n, marketPosition);

  const items: { label: string; description: string; value: ReactNode }[] = [
    {
      label: `Collateral (${market.collateralAsset.symbol})`,
      description: "Your position's collateral balance.",
      value: <NumberFlow value={collateralAssets} />,
    },
    {
      label: `Loan (${market.loanAsset.symbol})`,
      description: "Your positions borrow balance.",
      value: <NumberFlow value={borrowAssets} />,
    },
    {
      label: "Available to Borrow",
      description: `The additional amount your position is able to borrow from the market. This will provide a LTV with a ${formatNumber(MAX_BORROW_LTV_MARGIN, { style: "percent" })} margin below the market's LLTV.`,
      value: <NumberFlow value={descaleBigIntToNumber(rawAvailableToBorrow, market.loanAsset.decimals)} />,
    },
    {
      label: "Loan to value",
      description:
        "The current loan to value (LTV) of your position. If this exceeds the liqudation loan to value (LLTV) you will be liquidated.",
      value: (
        <span className="flex items-center whitespace-pre-wrap">
          <NumberFlow value={marketPosition?.ltv ?? 0} format={{ style: "percent" }} /> /{" "}
          {formatNumber(market.lltv ?? 0, { style: "percent" })}
        </span>
      ),
    },
    {
      label: "APY",
      description:
        "The current borrow APY of your position including rewards. This will equal the market's borrow APY.",
      value: <Apy type="borrow" apy={market.borrowApy} className="gap-1" />,
    },
  ];

  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="flex w-full justify-between">
          <TooltipPopover>
            <TooltipPopoverTrigger>{item.label}</TooltipPopoverTrigger>
            <TooltipPopoverContent>{item.description}</TooltipPopoverContent>
          </TooltipPopover>
          <span className="label-md">{isLoading ? <Skeleton className="h-5 w-12" /> : item.value}</span>
        </div>
      ))}
    </>
  );
}

export function AccountMarketPositionHighlight({ market }: MarketPositionProps) {
  const { address } = useAccount();
  const { data: marketPosition } = useAccountMarketPosition(market.marketId as Hex);

  // Hide if not connected
  if (!address || !marketPosition || !marketPosition.market) {
    return null;
  }

  return (
    <div className="flex flex-col md:items-end md:text-end">
      <MetricWithTooltip
        label={<span className="justify-end text-accent-ternary">Borrowing</span>}
        tooltip="Your borrow balance in this market."
        className="title-3 md:items-end"
      >
        <NumberFlow value={marketPosition.borrowAssetsUsd} format={{ currency: "USD" }} />
      </MetricWithTooltip>
      <div className="flex items-center gap-1 text-content-secondary label-sm">
        {market.loanAsset.icon && (
          <Image
            src={market.loanAsset.icon}
            width={12}
            height={12}
            alt={market.loanAsset.symbol}
            className="rounded-full"
          />
        )}
        <NumberFlow value={descaleBigIntToNumber(BigInt(marketPosition.borrowAssets), market.loanAsset.decimals)} />
      </div>
    </div>
  );
}

export function AccountMarketPositionAggregate() {
  const { data: accountMarketPositonAggregate, isLoading } = useAccountMarketPositionAggregate();
  return (
    <div className="flex gap-10 md:text-end">
      <MetricWithTooltip
        label={<span className="justify-end text-accent-ternary">Your Borrowing</span>}
        tooltip="Your total borrow balance across all markets."
        className="title-3 md:items-end"
      >
        <NumberFlowWithLoading
          value={accountMarketPositonAggregate?.totalBorrowUsd}
          format={{ currency: "USD" }}
          isLoading={isLoading}
          loadingContent={<Skeleton className="h-[36px] w-[70px]" />}
        />
      </MetricWithTooltip>

      <MetricWithTooltip
        label={<span className="justify-end">Avg. Borrow APY</span>}
        tooltip="Your average borrow APY across all markets, including rewards."
        className="title-3 md:items-end"
      >
        <NumberFlowWithLoading
          value={accountMarketPositonAggregate?.avgApy}
          format={{ style: "percent" }}
          isLoading={isLoading}
          loadingContent={<Skeleton className="h-[36px] w-[70px]" />}
        />
      </MetricWithTooltip>
    </div>
  );
}
