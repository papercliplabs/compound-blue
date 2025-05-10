import { Info } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getAddress } from "viem";

import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { useAccountVaultPosition } from "@/hooks/useAccountVaultPosition";
import { descaleBigIntToNumber } from "@/utils/format";

import Apy from "../Apy";
import { NumberInputFormField } from "../FormFields/NumberInputFormField";
import { MetricChange } from "../MetricChange";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

import { ProtocolMigratorFormValues } from "./ProtocolMigratorController";

interface ProtocolMigratorVaultDestinationProps {
  vault: VaultSummary;
  migrateValueUsd: number;
  openChange: () => void;
}

export function ProtocolMigratorVaultDestination({
  vault,
  migrateValueUsd,
  openChange,
}: ProtocolMigratorVaultDestinationProps) {
  const { data: position, isLoading } = useAccountVaultPosition(getAddress(vault.vaultAddress));

  const currentBalance = useMemo(() => {
    return position?.supplyAssets
      ? descaleBigIntToNumber(position?.supplyAssets ?? 0, vault.asset.decimals)
      : undefined;
  }, [position?.supplyAssets, vault.asset.decimals]);

  const migrateValueInUnderlying = useMemo(() => {
    return migrateValueUsd / (vault.asset.priceUsd ?? 0);
  }, [migrateValueUsd, vault.asset.priceUsd]);

  const form = useFormContext<ProtocolMigratorFormValues>();

  return (
    <CardContent className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src={vault.asset.icon} alt={vault.name} width={32} height={32} />
          <div>
            <h3 className="title-5">{vault.name}</h3>
            <div className="text-content-secondary label-sm">
              Vault • <Apy apy={vault.supplyApy} type="supply" />
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={openChange}>
          Change
        </Button>
      </div>
      <div className="h-[1px] w-full bg-border-primary" />
      <MetricChange
        name={`Balance (${vault.asset.symbol})`}
        initialValue={
          <NumberFlowWithLoading
            value={currentBalance == undefined ? undefined : currentBalance}
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
          />
        }
        finalValue={
          <NumberFlowWithLoading
            value={currentBalance == undefined ? undefined : currentBalance + migrateValueInUnderlying}
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
          />
        }
      />
      <div>
        <NumberInputFormField
          labelContent={
            <TooltipPopover>
              <TooltipPopoverTrigger className="flex items-center gap-1 paragraph-md">
                Max Slippage
                <Info size={16} />
              </TooltipPopoverTrigger>
              <TooltipPopoverContent className="flex flex-col gap-2">
                <p>The maximum deviation from the quote you are willing to accept.</p>
                <p>
                  Higher slippages increase success rates but may result in worse prices, while lower slippages ensure
                  better prices but may cause transactions to fail.
                </p>
              </TooltipPopoverContent>
            </TooltipPopover>
          }
          unit="%"
          control={form.control}
          name="maxSlippageTolerancePercent"
        />
      </div>
    </CardContent>
  );
}
