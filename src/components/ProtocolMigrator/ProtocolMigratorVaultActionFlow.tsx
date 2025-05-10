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
  if (!vault || !action || action.status != "success") {
    return null;
  }

  console.log("DEBUG", action.summary);

  return (
    <ActionFlowDialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        // if (!open && success) {
        //   onCloseAfterSuccess?.();
        // }
      }}
      signatureRequests={action.signatureRequests}
      transactionRequests={action.transactionRequests}
      //   flowCompletionCb={onFlowCompletion}
    >
      <ActionFlowSummary>
        <ActionFlowSummaryAssetItem
          asset={vault.asset}
          actionName={action.summary.positionChange.delta.amount > 0 ? "Supply" : "Withdraw"}
          side="supply"
          isIncreasing={action.summary.positionChange.delta.amount > 0}
          descaledAmount={Math.abs(action.summary.positionChange.delta.amount)}
          amountUsd={Math.abs(action.summary.positionChange.delta.amount) * (vault.asset.priceUsd ?? 0)}
        />
      </ActionFlowSummary>
      <ActionFlowReview>
        <MetricChange
          name={`Position (${vault.asset.symbol})`}
          initialValue={formatNumber(action.summary.positionChange.before.amount * (vault.asset.priceUsd ?? 0), {
            currency: "USD",
          })}
          finalValue={formatNumber(action.summary.positionChange.after.amount * (vault.asset.priceUsd ?? 0), {
            currency: "USD",
          })}
        />
        <MetricChange name="APY" initialValue={<Apy apy={vault.supplyApy} type="supply" />} />
      </ActionFlowReview>
      <ActionFlowButton>Migrate</ActionFlowButton>
    </ActionFlowDialog>
  );
}
