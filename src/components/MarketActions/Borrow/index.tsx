"use client";
import { MarketActionsProps } from "..";
import MarketSupplyCollateralBorrow from "./MarketSupplyCollateralBorrow";
import MarketLeverageBorrow from "./MarketLeverageBorrow";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export default function MarketBorrow({
  market,
  onCloseAfterSuccess,
}: MarketActionsProps & { onCloseAfterSuccess?: () => void }) {
  const { multiply: enableMultiply } = useFeatureFlags();
  return (
    <Tabs defaultValue="borrow" className="flex flex-col gap-6" value={enableMultiply ? undefined : "borrow"}>
      {enableMultiply && (
        <TabsList className="bg-background-primary md:bg-background-inverse">
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
