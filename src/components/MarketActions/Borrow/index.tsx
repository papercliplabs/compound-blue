"use client";
import { MarketActionsProps } from "..";
import MarketSupplyCollateralBorrow from "./MarketSupplyCollateralBorrow";
import MarketLeverageBorrow from "./MarketLeverageBorrow";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { isAssetVaultShare } from "@/utils/isAssetVaultShare";
import { getAddress } from "viem";
import { useMemo } from "react";

export default function MarketBorrow({
  market,
  onCloseAfterSuccess,
}: MarketActionsProps & { onCloseAfterSuccess?: () => void }) {
  const { multiply: enableMultiply } = useFeatureFlags();

  const collateralIsVault = useMemo(() => {
    return isAssetVaultShare(getAddress(market.collateralAsset.address));
  }, [market.collateralAsset.address]);

  return (
    <Tabs defaultValue="borrow" className="flex flex-col gap-6" value={enableMultiply ? undefined : "borrow"}>
      {/* Disable multiply for rehypothicated vault shares since not supported via Paraswap */}
      {enableMultiply && !collateralIsVault && (
        <TabsList className="bg-background-primary lg:bg-background-inverse">
          <TabsTrigger value="borrow">Borrow</TabsTrigger>
          <TabsTrigger value="multiply">Multiply</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value="borrow" asChild>
        <MarketSupplyCollateralBorrow market={market} onCloseAfterSuccess={onCloseAfterSuccess} />
      </TabsContent>
      <TabsContent value="multiply" asChild>
        <MarketLeverageBorrow market={market} onCloseAfterSuccess={onCloseAfterSuccess} />
      </TabsContent>
    </Tabs>
  );
}
