"use client";
import { ArrowRight, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
import { SlippageTooltipContent } from "../SlippageTooltipContent";
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

  const maxSlippageDerived = useMemo(() => {
    if (action?.status != "success" || action.worstCaseChange.positionCollateralChange.delta.amount == 0) {
      return 0;
    }

    return (
      action.quotedChange.positionCollateralChange.delta.amount /
        action.worstCaseChange.positionCollateralChange.delta.amount -
      1
    );
  }, [action]);

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
          rawAmount={action.quotedChange.positionCollateralChange.delta.rawAmount}
        />
        <ActionFlowSummaryAssetItem
          asset={market.loanAsset}
          actionName="Borrow"
          side="borrow"
          isIncreasing={true}
          rawAmount={action.quotedChange.positionLoanChange.delta.rawAmount}
        />
      </ActionFlowSummary>
      <ActionFlowReview>
        <MetricChange
          name={`Collateral (${market.collateralAsset?.symbol})`}
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
        <div className="h-[1px] w-full bg-border-primary" />
        <MetricChange
          name={
            <TooltipPopover>
              <TooltipPopoverTrigger className="flex items-center gap-1 paragraph-md">
                Max Slippage
                <Info size={14} className="stroke-content-secondary" />
              </TooltipPopoverTrigger>
              <TooltipPopoverContent>
                <SlippageTooltipContent
                  isEstimate
                  items={[
                    {
                      name: "Minimum collateral received",
                      value: `${formatNumber(action.worstCaseChange.positionCollateralChange.delta.amount)} ${market.collateralAsset?.symbol}`,
                    },
                    {
                      name: "Maximum LTV",
                      value: `${formatNumber(action.worstCaseChange.positionLtvChange.after, { style: "percent" })}`,
                    },
                  ]}
                />
              </TooltipPopoverContent>
            </TooltipPopover>
          }
          initialValue={formatNumber(maxSlippageDerived, { style: "percent" })}
        />
      </ActionFlowReview>
      <ActionFlowButton variant="borrow">Migrate</ActionFlowButton>
    </ActionFlowDialog>
  );
}
