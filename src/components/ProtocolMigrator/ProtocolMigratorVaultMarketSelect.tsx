"use client";
import { Plus } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { formatNumber } from "@/utils/format";

import Apy from "../Apy";
import { MarketIcon } from "../MarketIdentifier";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { DialogDrawerContent, DialogDrawerTitle, DialogDrawerTrigger } from "../ui/dialogDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export type ProtocolMigratorVaultMarketSelection =
  | {
      type: "vault";
      vault: VaultSummary;
    }
  | { type: "market"; market: MarketSummary };

interface ProtocolMigratorVaultMarketSelectProps {
  vaultSummaries: VaultSummary[];
  marketSummaries: MarketSummary[];
  onSelect: (selction: ProtocolMigratorVaultMarketSelection) => void;
  close: () => void;
}

export function ProtocolMigratorVaultMarketSelectTrigger() {
  return (
    <DialogDrawerTrigger className="h-full w-full transition-colors hover:bg-background-primary/20">
      <CardContent className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-[8px] bg-background-inverse">
            <Plus className="text-content-secondary" />
          </div>
          <span className="title-5">Select Vault / Market</span>
        </div>
        <Button asChild size="sm">
          <div>Select</div>
        </Button>
      </CardContent>
    </DialogDrawerTrigger>
  );
}

export function ProtocolMigratorVaultMarketSelectContent({
  vaultSummaries,
  marketSummaries,
  onSelect,
  close,
}: ProtocolMigratorVaultMarketSelectProps) {
  const sortedVaultSummaries = useMemo(
    () => vaultSummaries.sort((a, b) => b.supplyApy.total - a.supplyApy.total),
    [vaultSummaries]
  );

  const sortedMarketSummaries = useMemo(
    () => marketSummaries.sort((a, b) => a.borrowApy.total - b.borrowApy.total),
    [marketSummaries]
  );
  return (
    <DialogDrawerContent className="lg:max-h-[80dvh] lg:px-6 lg:pb-6">
      <DialogDrawerTitle className="px-4">Select Vault / Market</DialogDrawerTitle>
      <Tabs defaultValue="earn" className="flex h-full flex-col overflow-y-hidden">
        <TabsList className="bg-background-primary">
          <TabsTrigger value="earn">Earn</TabsTrigger>
          <TabsTrigger value="borrow">Borrow</TabsTrigger>
        </TabsList>
        <TabsContent value="earn">
          <div className="px-4 py-3 text-content-secondary label-sm">Vaults</div>
          <div className="flex flex-col">
            {sortedVaultSummaries.map((vault) => (
              <button
                key={vault.vaultAddress}
                className="flex h-[72px] w-full items-center gap-3 rounded-[8px] px-4 transition-colors hover:bg-background-primary"
                onClick={() => {
                  close();
                  onSelect({ type: "vault", vault });
                }}
                type="button"
              >
                <Image src={vault.asset.icon} alt={vault.name} width={32} height={32} />
                <div className="flex flex-col justify-between">
                  <span className="label-lg">{vault.name}</span>
                  <Apy
                    apy={vault.supplyApy}
                    type="supply"
                    className="gap-1 text-content-secondary"
                    showTooltip={false}
                  />
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="borrow" className="flex h-full flex-col overflow-hidden">
          <div className="px-4 py-3 text-content-secondary label-sm">Markets</div>
          <div className="flex flex-1 flex-col overflow-y-auto">
            {sortedMarketSummaries.map((market) => (
              <button
                key={market.marketId}
                className="flex h-[72px] w-full shrink-0 items-center gap-3 rounded-[8px] px-4 transition-colors hover:bg-background-primary"
                onClick={() => {
                  close();
                  onSelect({ type: "market", market });
                }}
                type="button"
              >
                <MarketIcon
                  loanAssetInfo={market.loanAsset}
                  collateralAssetInfo={market.collateralAsset ?? undefined}
                />
                <div className="flex flex-col justify-between">
                  <div className="flex items-center gap-1">
                    <span className="label-lg">{market.name}</span>
                    <div className="h-fit w-fit rounded-[4px] bg-button-neutral px-1 text-content-secondary label-sm">
                      {formatNumber(market.lltv, { style: "percent", minimumFractionDigits: 0 })}
                    </div>
                  </div>
                  <Apy
                    apy={market.borrowApy}
                    type="borrow"
                    className="gap-1 text-content-secondary"
                    showTooltip={false}
                  />
                </div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </DialogDrawerContent>
  );
}
