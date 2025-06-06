"use client";
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
          name={`Position (${vault.asset.symbol})`}
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
