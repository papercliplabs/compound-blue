"use client";
import { MathLib } from "@morpho-org/blue-sdk";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
import { SlippageTooltipContent } from "../SlippageTooltipContent";
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

  const maxSlippageDerived = useMemo(() => {
    if (action?.status != "success" || action.worstCaseChange.positionChange.delta.amount == 0) {
      return 0;
    }

    return action.quotedChange.positionChange.delta.amount / action.worstCaseChange.positionChange.delta.amount - 1;
  }, [action]);

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
          rawAmount={MathLib.abs(action.quotedChange.positionChange.delta.rawAmount)}
        />
      </ActionFlowSummary>
      <ActionFlowReview>
        <MetricChange
          name={`Balance (${vault.asset.symbol})`}
          initialValue={formatNumber(action.quotedChange.positionChange.before.amount * (vault.asset.priceUsd ?? 0), {
            currency: "USD",
          })}
          finalValue={formatNumber(action.quotedChange.positionChange.after.amount * (vault.asset.priceUsd ?? 0), {
            currency: "USD",
          })}
        />
        <MetricChange name="APY" initialValue={<Apy apy={vault.supplyApy} type="supply" />} />
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
                  items={[
                    {
                      name: "Minimum received",
                      value: `${formatNumber(action.worstCaseChange.positionChange.delta.amount)} ${vault.asset.symbol}`,
                    },
                  ]}
                />
              </TooltipPopoverContent>
            </TooltipPopover>
          }
          initialValue={formatNumber(maxSlippageDerived, { style: "percent" })}
        />
      </ActionFlowReview>
      <ActionFlowButton>Migrate</ActionFlowButton>
    </ActionFlowDialog>
  );
}
