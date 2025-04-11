import { MarketActionsProps } from "..";
import MarketSupplyCollateralBorrow from "./MarketSupplyCollateralBorrow";
import MarketLeverageBorrow from "./MarketLeverageBorrow";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";

export default function MarketBorrow({
  market,
  onCloseAfterSuccess,
  disableLeverage,
}: MarketActionsProps & { onCloseAfterSuccess?: () => void }) {
  return (
    <Tabs defaultValue="borrow" className="flex flex-col gap-6" value={disableLeverage ? "borrow" : undefined}>
      {!disableLeverage && (
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
