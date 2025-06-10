import { ArrowRight, Info } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { useDebounce } from "use-debounce";
import { Hex } from "viem";

import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import { useWatchNumberField } from "@/hooks/useWatchNumberField";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { computeNewBorrowMax } from "@/utils/market";

import Apy from "../Apy";
import AssetFormField from "../FormFields/AssetFormField";
import { MarketIcon } from "../MarketIdentifier";
import { MetricChange } from "../MetricChange";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import NumberFlow, { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

import { ProtocolMigratorFormValues } from "./ProtocolMigratorController";

interface ProtocolMigratorMarketDestinationProps {
  market: MarketSummary;
  quotedMigrateValueUsd: number;
  minMigrateValueUsd: number;
  openChange: () => void;
}

export function ProtocolMigratorMarketDestination({
  market,
  quotedMigrateValueUsd,
  minMigrateValueUsd,
  openChange,
}: ProtocolMigratorMarketDestinationProps) {
  const { data: position, isLoading } = useAccountMarketPosition(market.marketId as Hex);

  const { currentCollateralBalance, currentLoanBalance } = useMemo(() => {
    if (!position) {
      return {
        currentCollateralBalance: undefined,
        currentLoanBalance: undefined,
      };
    }
    return {
      currentCollateralBalance: position?.collateralAssets
        ? descaleBigIntToNumber(position?.collateralAssets ?? 0, market.collateralAsset.decimals)
        : undefined,
      currentLoanBalance: position?.borrowAssets
        ? descaleBigIntToNumber(position?.borrowAssets ?? 0, market.loanAsset.decimals)
        : undefined,
    };
  }, [position, market.collateralAsset, market.loanAsset]);

  const { quotedMigrateValueInCollateral, minMigrateValueInCollateral } = useMemo(() => {
    const priceUsd = market.collateralAsset.priceUsd ?? 0;
    return {
      quotedMigrateValueInCollateral: priceUsd > 0 ? quotedMigrateValueUsd / priceUsd : 0,
      minMigrateValueInCollateral: priceUsd > 0 ? minMigrateValueUsd / priceUsd : 0,
    };
  }, [quotedMigrateValueUsd, minMigrateValueUsd, market.collateralAsset]);

  const form = useFormContext<ProtocolMigratorFormValues>();

  const borrowMax = useMemo(() => {
    // Borrow max computed based on min collateral to ensure that in the worst case we always will respect the max LTV
    return computeNewBorrowMax(market, minMigrateValueInCollateral, position);
  }, [market, minMigrateValueInCollateral, position]);

  const borrowAmount = useWatchNumberField({ control: form.control, name: "borrowAmount" });
  const [borrowAmountDebounced] = useDebounce(borrowAmount, 200);

  // borrowAmount validation for borrowMax
  useEffect(() => {
    const errorMessage = "Amount exceeds borrow capacity.";
    const isInvalid = borrowAmount > borrowMax;
    const currentError = form.getFieldState("borrowAmount").error;

    if (isInvalid) {
      if (!currentError || currentError.message !== errorMessage) {
        form.setError("borrowAmount", {
          type: "manual",
          message: "Amount exceeds borrow capacity.",
        });
      }
    } else if (currentError?.type === "manual" && currentError.message === errorMessage) {
      // Only clear if *we* set the manual error
      form.clearErrors("borrowAmount");
    }
  }, [borrowAmount, borrowMax, form]);

  return (
    <CardContent className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MarketIcon loanAssetInfo={market.loanAsset} collateralAssetInfo={market.collateralAsset} />
          <div>
            <h3 className="label-md">{market.name}</h3>
            <div className="text-content-secondary label-sm">
              Market • <Apy apy={market.borrowApy} type="borrow" />
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={openChange}>
          Change
        </Button>
      </div>
      <div className="h-[1px] w-full bg-border-primary" />
      <div className="[&_label]:text-accent-ternary">
        <AssetFormField
          control={form.control}
          name="borrowAmount"
          actionName="Borrow"
          asset={market.loanAsset}
          descaledAvailableBalance={borrowMax}
        />
      </div>
      <div className="h-[1px] w-full bg-border-primary" />
      <MetricChange
        name={
          <TooltipPopover>
            <TooltipPopoverTrigger className="flex items-center gap-1">
              <span>Collateral ({market.collateralAsset?.symbol})</span>
              <Info size={14} className="stroke-content-secondary" />
            </TooltipPopoverTrigger>
            <TooltipPopoverContent className="flex min-w-[280px] flex-col gap-2">
              <p className="paragraph-sm">
                Below are the estimated worst-case values based on the slippage you&apos;ve set.
              </p>
              <div className="flex flex-col gap-2 rounded-[8px] bg-background-inverse p-2 text-content-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-sm">Minimum collateral received:</span>
                  <span className="inline-flex items-center gap-1 label-sm">
                    <NumberFlow value={minMigrateValueInCollateral} />
                    {market.collateralAsset?.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="label-sm">Maximum LTV:</span>
                  <span className="label-sm">
                    <NumberFlowWithLoading
                      value={
                        !position
                          ? undefined
                          : position.collateralAssetsUsd + minMigrateValueUsd == 0
                            ? 0
                            : (position.borrowAssetsUsd + borrowAmountDebounced * (market.loanAsset.priceUsd ?? 0)) /
                              (position.collateralAssetsUsd + minMigrateValueUsd)
                      }
                      isLoading={isLoading}
                      loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
                      format={{ style: "percent" }}
                    />
                  </span>
                </div>
              </div>
            </TooltipPopoverContent>
          </TooltipPopover>
        }
        initialValue={
          <NumberFlowWithLoading
            value={currentCollateralBalance == undefined ? undefined : currentCollateralBalance}
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
          />
        }
        finalValue={
          <NumberFlowWithLoading
            value={
              currentCollateralBalance == undefined
                ? undefined
                : currentCollateralBalance + quotedMigrateValueInCollateral
            }
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
          />
        }
      />
      <MetricChange
        name={`Loan (${market.loanAsset.symbol})`}
        initialValue={
          <NumberFlowWithLoading
            value={currentLoanBalance == undefined ? undefined : currentLoanBalance}
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
          />
        }
        finalValue={
          <NumberFlowWithLoading
            value={currentLoanBalance == undefined ? undefined : currentLoanBalance + (borrowAmountDebounced ?? 0)}
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
          />
        }
      />
      <div className="flex items-center justify-between">
        <span>LTV / LLTV</span>
        <div className="flex items-center gap-1 label-md">
          (
          <span className="text-content-secondary">
            <NumberFlowWithLoading
              value={
                !position
                  ? undefined
                  : position.collateralAssetsUsd == 0
                    ? 0
                    : position.borrowAssetsUsd / position.collateralAssetsUsd
              }
              isLoading={isLoading}
              loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
              format={{ style: "percent" }}
            />
          </span>
          <ArrowRight size={14} className="stroke-content-secondary" />
          <NumberFlowWithLoading
            value={
              !position
                ? undefined
                : position.collateralAssetsUsd + quotedMigrateValueUsd == 0
                  ? 0
                  : (position.borrowAssetsUsd + borrowAmountDebounced * (market.loanAsset.priceUsd ?? 0)) /
                    (position.collateralAssetsUsd + quotedMigrateValueUsd)
            }
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
            format={{ style: "percent" }}
          />
          ) / {formatNumber(market.lltv, { style: "percent" })}
        </div>
      </div>
    </CardContent>
  );
}
