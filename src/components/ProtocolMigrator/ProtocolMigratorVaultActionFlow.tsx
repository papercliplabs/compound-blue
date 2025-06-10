"use client";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AaveV3PortfolioMigrationToVaultAction } from "@/actions/migration/aaveV3PortfolioMigrationToVaultAction";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { formatNumber } from "@/utils/format";

import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowReview,
  ActionFlowSummary,
  ActionFlowSummaryAssetItem,
} from "../ActionFlowDialog";
import Apy from "../Apy";
import { MetricChange } from "../MetricChange";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

// TODO: could generalize this to be used for all vault actions...

interface ProtocolMigratorVaultActionFlowProps {
  vault?: VaultSummary;
  action?: AaveV3PortfolioMigrationToVaultAction;

  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProtocolMigratorVaultActionFlow({
  vault,
  action,

  open,
  onOpenChange,
}: ProtocolMigratorVaultActionFlowProps) {
  const [completed, setCompleted] = useState(false);
  const router = useRouter();

  if (!vault || !action || action.status != "success") {
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
          asset={vault.asset}
          actionName={action.quotedChange.positionChange.delta.amount > 0 ? "Supply" : "Withdraw"}
          side="supply"
          isIncreasing={action.quotedChange.positionChange.delta.amount > 0}
          descaledAmount={Math.abs(action.quotedChange.positionChange.delta.amount)}
          amountUsd={Math.abs(action.quotedChange.positionChange.delta.amount) * (vault.asset.priceUsd ?? 0)}
        />
      </ActionFlowSummary>
      <ActionFlowReview>
        <MetricChange
          name={
            <TooltipPopover>
              <TooltipPopoverTrigger className="flex items-center gap-1">
                <span>Balance ({vault.asset.symbol})</span>
                <Info size={14} className="stroke-content-secondary" />
              </TooltipPopoverTrigger>
              <TooltipPopoverContent className="flex min-w-[280px] flex-col gap-2">
                <p className="paragraph-sm">Below are the worst-case values based on the slippage you&apos;ve set.</p>
                <div className="flex flex-col gap-2 rounded-[8px] bg-background-inverse p-2 text-content-secondary">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-sm">Minimum received:</span>
                    <span className="label-sm">
                      {formatNumber(action.worstCaseChange.positionChange.delta.amount * (vault.asset.priceUsd ?? 0), {
                        currency: "USD",
                      })}
                    </span>
                  </div>
                </div>
              </TooltipPopoverContent>
            </TooltipPopover>
          }
          initialValue={formatNumber(action.quotedChange.positionChange.before.amount * (vault.asset.priceUsd ?? 0), {
            currency: "USD",
          })}
          finalValue={formatNumber(action.quotedChange.positionChange.after.amount * (vault.asset.priceUsd ?? 0), {
            currency: "USD",
          })}
        />
        <MetricChange name="APY" initialValue={<Apy apy={vault.supplyApy} type="supply" />} />
      </ActionFlowReview>
      <ActionFlowButton>Migrate</ActionFlowButton>
    </ActionFlowDialog>
  );
}
