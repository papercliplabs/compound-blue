import { Info } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { getAddress } from "viem";

import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { useAccountVaultPosition } from "@/hooks/useAccountVaultPosition";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";

import Apy from "../Apy";
import { NumberInputFormField } from "../FormFields/NumberInputFormField";
import { MetricChange } from "../MetricChange";
import { SlippageTooltipContent } from "../SlippageTooltipContent";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "../ui/tooltipPopover";

import { ProtocolMigratorFormValues } from "./ProtocolMigratorController";

interface ProtocolMigratorVaultDestinationProps {
  vault: VaultSummary;
  quotedMigrateValueUsd: number;
  minMigrateValueUsd: number;
  openChange: () => void;
}

export function ProtocolMigratorVaultDestination({
  vault,
  quotedMigrateValueUsd,
  minMigrateValueUsd,
  openChange,
}: ProtocolMigratorVaultDestinationProps) {
  const { data: position, isLoading } = useAccountVaultPosition(getAddress(vault.vaultAddress));

  const currentBalance = useMemo(() => {
    return position?.supplyAssets
      ? descaleBigIntToNumber(position?.supplyAssets ?? 0, vault.asset.decimals)
      : undefined;
  }, [position?.supplyAssets, vault.asset.decimals]);

  const { quotedMigrateValueInUnderlying, minMigrateValueInUnderlying } = useMemo(() => {
    const priceUsd = vault.asset.priceUsd ?? 0;
    return {
      quotedMigrateValueInUnderlying: priceUsd > 0 ? quotedMigrateValueUsd / priceUsd : 0,
      minMigrateValueInUnderlying: priceUsd > 0 ? minMigrateValueUsd / priceUsd : 0,
    };
  }, [quotedMigrateValueUsd, minMigrateValueUsd, vault.asset]);

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
            value={currentBalance == undefined ? undefined : currentBalance + quotedMigrateValueInUnderlying}
            isLoading={isLoading}
            loadingContent={<Skeleton className="h-[18px] w-[50px]" />}
          />
        }
      />

      <div className="h-[1px] w-full bg-border-primary" />

      <NumberInputFormField
        control={form.control}
        name="maxSlippageTolerancePercent"
        labelContent={
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
                    name: "Minimum received",
                    value: `${formatNumber(minMigrateValueInUnderlying)} ${vault.asset.symbol}`,
                  },
                ]}
              />
            </TooltipPopoverContent>
          </TooltipPopover>
        }
        unit="%"
      />
    </CardContent>
  );
}
