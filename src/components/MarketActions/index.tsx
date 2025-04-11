"use client";
import { CardContent } from "../ui/card";
import { Card } from "../ui/card";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Hex } from "viem";
import { useResponsiveContext } from "@/providers/ResponsiveProvider";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "../ui/drawer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { MarketNonIdle } from "@/data/whisk/getMarket";
import { useAccountMarketPosition } from "@/hooks/useAccountMarketPosition";
import MarketMigrationCallout from "../MarketMigrationCallout";
import MarketBorrow from "./Borrow";
import MarketRepay from "./Repay";

export interface MarketActionsProps {
  market: MarketNonIdle;
}

export default function MarketActions({ market }: MarketActionsProps) {
  const { data: accountMarketPosition } = useAccountMarketPosition(market.marketId as Hex);
  const { isDesktop, hasMounted } = useResponsiveContext();

  // Only if the account has a position to withdraw
  const canRepayAndWithdraw = useMemo(() => {
    return (
      BigInt(accountMarketPosition?.borrowAssets ?? 0) > BigInt(0) ||
      BigInt(accountMarketPosition?.collateralAssets ?? 0) > BigInt(0)
    );
  }, [accountMarketPosition]);

  // Wait to render until we know to prevent layout glitches
  if (!hasMounted) {
    return null;
  }

  if (isDesktop) {
    return <MarketActionsDesktop market={market} canRepayAndWithdraw={canRepayAndWithdraw} />;
  } else {
    return <MarketActionsMobile market={market} canRepayAndWithdraw={canRepayAndWithdraw} />;
  }
}

function MarketActionsDesktop({ market, canRepayAndWithdraw }: MarketActionsProps & { canRepayAndWithdraw: boolean }) {
  const [selection, setSelection] = useState<"borrow" | "repay">("borrow");

  // Default to supply-borrow
  useEffect(() => {
    if (!canRepayAndWithdraw) {
      setSelection("borrow");
    }
  }, [canRepayAndWithdraw]);

  return (
    <div className="relative">
      {canRepayAndWithdraw && (
        <div className="absolute -top-[16px] flex -translate-y-full gap-2">
          <Button
            variant={selection == "borrow" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelection("borrow")}
          >
            Borrow
          </Button>
          <Button
            variant={selection == "repay" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelection("repay")}
          >
            Repay
          </Button>
        </div>
      )}

      <div className="rounded-[12px] bg-[#3B2870]">
        <MarketMigrationCallout market={market} />
        <Card>
          <CardContent>
            {selection == "borrow" && <MarketBorrow market={market} />}
            {selection == "repay" && <MarketRepay market={market} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MarketActionsMobile({ market, canRepayAndWithdraw }: MarketActionsProps & { canRepayAndWithdraw: boolean }) {
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[20] flex items-center gap-[10px] bg-background-primary/15 px-4 py-3 backdrop-blur-lg">
        <Drawer open={borrowOpen} onOpenChange={setBorrowOpen}>
          <DrawerTrigger asChild>
            <Button className="w-full bg-accent-ternary">Borrow</Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="flex rounded-[12px] bg-[#3B2870]">
              <MarketMigrationCallout market={market} />
            </div>
            <VisuallyHidden>
              <DrawerTitle>Add collateral and borrow from market</DrawerTitle>
            </VisuallyHidden>
            <MarketBorrow market={market} onCloseAfterSuccess={() => setBorrowOpen(false)} />
          </DrawerContent>
        </Drawer>

        <Drawer open={repayOpen} onOpenChange={setRepayOpen}>
          <DrawerTrigger asChild>
            <Button className="w-full" variant="secondary" disabled={!canRepayAndWithdraw}>
              Repay
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <VisuallyHidden>
              <DrawerTitle>Repay loan and withdraw collateral from market</DrawerTitle>
            </VisuallyHidden>
            <MarketRepay market={market} onCloseAfterSuccess={() => setRepayOpen(false)} />
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
