import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import MarketRepayWithdrawCollateral from "./MarketRepayWithdrawCollateral";
import MarketRepayWithCollateral from "./MarketRepayWithCollateral";
import { Info } from "lucide-react";
import { TooltipPopover, TooltipPopoverContent, TooltipPopoverTrigger } from "@/components/ui/tooltipPopover";
import { MarketNonIdle } from "@/data/whisk/getMarket";

export default function MarketRepay({
  market,
  onCloseAfterSuccess,
}: {
  market: MarketNonIdle;
  onCloseAfterSuccess?: () => void;
}) {
  return (
    <Tabs defaultValue="wallet-balance" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <TooltipPopover>
          <TooltipPopoverTrigger className="flex w-fit items-center gap-1 text-content-secondary label-sm">
            Repay with
            <Info size={14} />
          </TooltipPopoverTrigger>
          <TooltipPopoverContent>
            Repay your borrowed assets using either tokens from your wallet, or by automatically swapping some of your
            supplied collateral.
          </TooltipPopoverContent>
        </TooltipPopover>
        <TabsList className="bg-background-primary md:bg-background-inverse">
          <TabsTrigger value="wallet-balance">Wallet balance</TabsTrigger>
          <TabsTrigger value="collateral">Collateral</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="wallet-balance" asChild>
        <MarketRepayWithdrawCollateral market={market} onCloseAfterSuccess={onCloseAfterSuccess} />
      </TabsContent>
      <TabsContent value="collateral" asChild>
        <MarketRepayWithCollateral market={market} onCloseAfterSuccess={onCloseAfterSuccess} />
      </TabsContent>
    </Tabs>
  );
}
