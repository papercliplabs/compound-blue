import Image from "next/image";
import { useMemo } from "react";
import { getAddress } from "viem";

import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { useAccountVaultPosition } from "@/hooks/useAccountVaultPosition";
import { descaleBigIntToNumber } from "@/utils/format";

import Apy from "../Apy";
import { MetricChange } from "../MetricChange";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { NumberFlowWithLoading } from "../ui/NumberFlow";
import { Skeleton } from "../ui/skeleton";

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
    </CardContent>
  );
}
