"use client";
import { CardContent } from "../ui/card";
import { Card } from "../ui/card";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { useUserMarketPosition } from "@/providers/UserPositionProvider";
import { Market } from "@/data/whisk/getMarket";
import { Hex } from "viem";
import MarketSupplyBorrow from "./MarketSupplyBorrow";
import MarketRepayWithdraw from "./MarketRepayWithdraw";

export interface MarketActionsProps {
  market: Market;
}

export default function MarketActions({ market }: MarketActionsProps) {
  const [selection, setSelection] = useState<"supply-borrow" | "repay-withdraw">("supply-borrow");
  const { data: userMarketPosition } = useUserMarketPosition(market.marketId as Hex);

  // Only if the user has a position to withdraw
  const shouldShowSelector = useMemo(() => {
    return BigInt(userMarketPosition?.borrowAssets ?? 0) > BigInt(0);
  }, [userMarketPosition]);

  // Default to supply-borrow
  useEffect(() => {
    if (!shouldShowSelector) {
      setSelection("supply-borrow");
    }
  }, [shouldShowSelector]);

  return (
    <div className="relative">
      {shouldShowSelector && (
        <div className="absolute -top-[16px] flex -translate-y-full gap-2">
          <Button
            variant={selection == "supply-borrow" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelection("supply-borrow")}
          >
            Borrow
          </Button>
          <Button
            variant={selection == "repay-withdraw" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelection("repay-withdraw")}
          >
            Repay
          </Button>
        </div>
      )}

      <Card>
        <CardContent>
          {selection == "supply-borrow" && <MarketSupplyBorrow market={market} />}
          {selection == "repay-withdraw" && <MarketRepayWithdraw market={market} />}
        </CardContent>
      </Card>
    </div>
  );
}
