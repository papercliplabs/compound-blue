"use client";
import { ArrowRight, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AaveV3PortfolioMigrationToMarketAction } from "@/actions/migration/aaveV3PortfolioMigrationToMarketAction";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { formatNumber } from "@/utils/format";

import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "../ActionFlowDialog";
import { MetricChange } from "../MetricChange";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

// TODO: could generalize this to be used for all market actions...

interface ProtocolMigratorMarketActionFlowProps {
  market?: MarketSummary;
  action?: AaveV3PortfolioMigrationToMarketAction;

  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProtocolMigratorMarketActionFlow({
  market,
  action,

  open,
  onOpenChange,
}: ProtocolMigratorMarketActionFlowProps) {
  const [completed, setCompleted] = useState(false);
  const router = useRouter();

  if (!market || !action || action.status != "success") {
    return null;
  }

  return (
    <ActionFlowDialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open && completed) {
          router.push("/migrate");
        }
      }}
      signatureRequests={action.signatureRequests}
      transactionRequests={action.transactionRequests}
      flowCompletionCb={() => setCompleted(true)}
    >
      <ActionFlowSummary>
        <ActionFlowSummaryAssetItem
          asset={market.collateralAsset}
          actionName="Add"
          side="supply"
          isIncreasing={true}
          descaledAmount={action.quotedChange.positionCollateralChange.delta.amount}
          amountUsd={action.quotedChange.positionCollateralChange.delta.amount * (market.collateralAsset.priceUsd ?? 0)}
        />
        <ActionFlowSummaryAssetItem
          asset={market.loanAsset}
          actionName="Borrow"
          side="borrow"
          isIncreasing={true}
          descaledAmount={action.quotedChange.positionLoanChange.delta.amount}
          amountUsd={action.quotedChange.positionLoanChange.delta.amount * (market.loanAsset.priceUsd ?? 0)}
        />
      </ActionFlowSummary>
      <ActionFlowReview>
        <MetricChange
          name={
            <TooltipPopover>
              <TooltipPopoverTrigger className="flex items-center gap-1">
                <span>Collateral ({market.collateralAsset?.symbol})</span>
                <Info size={14} className="stroke-content-secondary" />
              </TooltipPopoverTrigger>
              <TooltipPopoverContent className="flex min-w-[280px] flex-col gap-2">
                <p className="paragraph-sm">Below are the worst-case values based on the slippage you&apos;ve set.</p>
                <div className="flex flex-col gap-2 rounded-[8px] bg-background-inverse p-2 text-content-secondary">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-sm">Minimum collateral received:</span>
                    <span className="inline-flex items-center gap-1 label-sm">
                      {formatNumber(
                        action.worstCaseChange.positionCollateralChange.delta.amount *
                          (market.collateralAsset.priceUsd ?? 0),
                        { currency: "USD" }
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-sm">Maximum LTV:</span>
                    <span className="label-sm">
                      {formatNumber(action.worstCaseChange.positionLtvChange.after, { style: "percent" })}
                    </span>
                  </div>
                </div>
              </TooltipPopoverContent>
            </TooltipPopover>
          }
          initialValue={formatNumber(
            action.quotedChange.positionCollateralChange.before.amount * (market.collateralAsset.priceUsd ?? 0),
            { currency: "USD" }
          )}
          finalValue={formatNumber(
            action.quotedChange.positionCollateralChange.after.amount * (market.collateralAsset.priceUsd ?? 0),
            { currency: "USD" }
          )}
        />
        <MetricChange
          name={`Loan (${market.loanAsset.symbol})`}
          initialValue={formatNumber(
            action.quotedChange.positionLoanChange.before.amount * (market.loanAsset.priceUsd ?? 0),
            { currency: "USD" }
          )}
          finalValue={formatNumber(
            action.quotedChange.positionLoanChange.after.amount * (market.loanAsset.priceUsd ?? 0),
            {
              currency: "USD",
            }
          )}
        />
        <div className="flex items-center justify-between">
          <span>LTV / LLTV</span>
          <div className="flex items-center gap-1 label-md">
            <span className="text-content-secondary">
              (
              {formatNumber(action.quotedChange.positionLtvChange.before, {
                style: "percent",
              })}
            </span>
            <ArrowRight size={14} className="stroke-content-secondary" />
            {formatNumber(action.quotedChange.positionLtvChange.after, {
              style: "percent",
            })}
            ) / {formatNumber(market.lltv, { style: "percent" })}
          </div>
        </div>
      </ActionFlowReview>
      <ActionFlowButton variant="borrow">Migrate</ActionFlowButton>
    </ActionFlowDialog>
  );
}
