"use client";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

import { MarketActionsProps } from "..";

import MarketLeverageBorrow from "./MarketLeverageBorrow";
import MarketSupplyCollateralBorrow from "./MarketSupplyCollateralBorrow";

export default function MarketBorrow({
  market,
  onCloseAfterSuccess,
}: MarketActionsProps & { onCloseAfterSuccess?: () => void }) {
  const { multiply: enableMultiply } = useFeatureFlags();

  // const disallowSwaps = useMemo(() => {
  //   return (
  //     ASSETS_EXCLUDED_FROM_SWAPS.includes(getAddress(market.collateralAsset.address)) ||
  //     ASSETS_EXCLUDED_FROM_SWAPS.includes(getAddress(market.loanAsset.address))
  //   );
  // }, [market.collateralAsset.address, market.loanAsset.address]);

  return (
    <Tabs defaultValue="borrow" className="flex flex-col gap-6" value={enableMultiply ? undefined : "borrow"}>
      {/* Disable multiply for rehypothicated vault shares since not supported via Paraswap */}
      {/* {enableMultiply && !disallowSwaps && (
        <TabsList className="bg-background-primary lg:bg-background-inverse">
          <TabsTrigger value="borrow">Borrow</TabsTrigger>
          <TabsTrigger value="multiply">Multiply</TabsTrigger>
        </TabsList>
      )} */}
      <TabsContent value="borrow" asChild>
        <MarketSupplyCollateralBorrow market={market} onCloseAfterSuccess={onCloseAfterSuccess} />
      </TabsContent>
      <TabsContent value="multiply" asChild>
        <MarketLeverageBorrow market={market} onCloseAfterSuccess={onCloseAfterSuccess} />
      </TabsContent>
    </Tabs>
  );
}
