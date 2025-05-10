"use client";
import { MarketSummary } from "@/data/whisk/getMarketSummaries";
import { VaultSummary } from "@/data/whisk/getVaultSummaries";
import { Address, getAddress, Hex } from "viem";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle, DialogDrawerTrigger } from "../ui/dialogDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useMemo, useState } from "react";
import Image from "next/image";
import Apy from "../Apy";
import { MarketIcon } from "../MarketIdentifier";
import { formatNumber } from "@/utils/format";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { Plus } from "lucide-react";

export type ProtocolMigratorVaultMarketSelection =
  | {
      type: "vault";
      vaultAddress: Address;
    }
  | { type: "market"; marketId: Hex };

interface ProtocolMigratorVaultMarketSelectProps {
  vaultSummaries: VaultSummary[];
  marketSummaries: MarketSummary[];
  onSelect: (selction: ProtocolMigratorVaultMarketSelection) => void;
}

export default function ProtocolMigratorVaultMarketSelect({
  vaultSummaries,
  marketSummaries,
  onSelect,
}: ProtocolMigratorVaultMarketSelectProps) {
  const [open, setOpen] = useState(false);
  const sortedVaultSummaries = useMemo(
    () => vaultSummaries.sort((a, b) => b.supplyApy.total - a.supplyApy.total),
    [vaultSummaries]
  );

  const sortedMarketSummaries = useMemo(
    () => marketSummaries.sort((a, b) => a.borrowApy.total - b.borrowApy.total),
    [marketSummaries]
  );

  return (
    <DialogDrawer open={open} onOpenChange={setOpen}>
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
      <DialogDrawerContent className="px-6 pb-6">
        <DialogDrawerTitle className="px-4">Select Vault / Market</DialogDrawerTitle>
        <Tabs defaultValue="earn">
          <TabsList className="px-4">
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
                    setOpen(false);
                    onSelect({ type: "vault", vaultAddress: getAddress(vault.vaultAddress) });
                  }}
                >
                  <Image src={vault.asset.icon} alt={vault.name} width={32} height={32} />
                  <div className="flex flex-col justify-between">
                    <span className="label-lg">{vault.name}</span>
                    <Apy
                      apy={vault.supplyApy}
                      type="supply"
                      middleContent="APY"
                      className="gap-1 text-content-secondary"
                    />
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="borrow">
            <div className="px-4 py-3 text-content-secondary label-sm">Markets</div>
            <div className="flex flex-col">
              {sortedMarketSummaries.map((market) => (
                <button
                  key={market.marketId}
                  className="flex h-[72px] w-full items-center gap-3 rounded-[8px] px-4 transition-colors hover:bg-background-primary"
                  onClick={() => {
                    setOpen(false);
                    onSelect({ type: "market", marketId: market.marketId as Hex });
                  }}
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
                      middleContent="APY"
                      className="gap-1 text-content-secondary"
                    />
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogDrawerContent>
    </DialogDrawer>
  );
}
