"use client";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { Hex } from "viem";
import { useUserMarketPosition, useUserPositionContext } from "@/providers/UserPositionProvider";
import { useMemo } from "react";
import { Skeleton } from "./ui/skeleton";
import Metric from "./Metric";
import { useAccount } from "wagmi";
import Image from "next/image";
import NumberFlow from "./ui/NumberFlow";
import Apy from "./Apy";

interface MarketPositionProps {
  marketId: Hex;
}

export function UserMarketPosition({ marketId }: MarketPositionProps) {
  const { data: marketPosition, isLoading } = useUserMarketPosition(marketId);

  return (
    <>
      <div className="flex w-full justify-between font-semibold">
        <span>Collateral</span>
        <span>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <NumberFlow value={marketPosition?.collateralAssetsUsd ?? 0} format={{ currency: "USD" }} />
          )}
        </span>
      </div>

      <div className="flex w-full justify-between font-semibold">
        <span>Borrow</span>
        <span>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <NumberFlow value={marketPosition?.borrowAssetsUsd ?? 0} format={{ currency: "USD" }} />
          )}
        </span>
      </div>

      <div className="flex w-full justify-between font-semibold">
        <span>Available to Borrow</span>
        <span>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <NumberFlow
              value={Math.max((marketPosition?.maxBorrowAssetsUsd ?? 0) - (marketPosition?.borrowAssetsUsd ?? 0), 0)}
              format={{ currency: "USD" }}
            />
          )}
        </span>
      </div>

      <div className="flex w-full justify-between font-semibold">
        <span>Loan to value</span>
        <span>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <>
              <NumberFlow value={marketPosition?.ltv ?? 0} format={{ style: "percent" }} /> /{" "}
              {formatNumber(marketPosition?.market?.lltv ?? 0, { style: "percent" })}
            </>
          )}
        </span>
      </div>

      <div className="flex w-full justify-between font-semibold">
        <span>Apy</span>
        <span>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : marketPosition?.market != undefined ? (
            <Apy type="supply" apy={marketPosition.market.borrowApy} className="gap-1" />
          ) : (
            "0.00%"
          )}
        </span>
      </div>
    </>
  );
}

export function UserMarketPositionHighlight({ marketId }: MarketPositionProps) {
  const { address } = useAccount();
  const { data: marketPosition } = useUserMarketPosition(marketId);

  // Hide if not connected
  if (!address || !marketPosition || !marketPosition.market) {
    return null;
  }

  return (
    <div className="flex flex-col md:items-end md:text-end">
      <Metric label={<span className="justify-end text-accent-ternary">Borrowing</span>} description="TODO">
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
      <Metric label={<span className="justify-end text-accent-ternary">Your Borrowing</span>} description="TODO">
        <span className="title-3">
          <NumberFlow value={totalBorrowUsd} format={{ currency: "USD" }} />
        </span>
      </Metric>

      <Metric label={<span className="justify-end">Avg. Borrow APY</span>} description="TODO">
        <span className="title-3">
          <NumberFlow value={avgApy} format={{ style: "percent" }} />
        </span>
      </Metric>
    </div>
  );
}
