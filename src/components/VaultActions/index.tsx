"use client";
import { Vault } from "@/data/whisk/getVault";
import VaultSupply from "./VaultSupply";
import { CardContent } from "../ui/card";
import { Card } from "../ui/card";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { useUserVaultPosition } from "@/providers/UserPositionProvider";
import VaultWithdraw from "./VaultWithdraw";
import { getAddress } from "viem";
import { useResponsiveContext } from "@/providers/ResponsiveProvider";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "../ui/drawer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export interface VaultActionsProps {
  vault: Vault;
}

export default function VaultActions({ vault }: VaultActionsProps) {
  const { data: userVaultPosition } = useUserVaultPosition(getAddress(vault.vaultAddress));
  const { isDesktop, hasMounted } = useResponsiveContext();

  // Only if the user has a position to withdraw
  const hasSupplyPosition = useMemo(() => {
    return BigInt(userVaultPosition?.supplyAssets ?? 0) > BigInt(0);
  }, [userVaultPosition]);

  // Wait to render until we know to prevent layout glitches
  if (!hasMounted) {
    return null;
  }

  if (isDesktop) {
    return <VaultActionsDesktop vault={vault} hasSupplyPosition={hasSupplyPosition} />;
  } else {
    return <VaultActionsMobile vault={vault} hasSupplyPosition={hasSupplyPosition} />;
  }
}

function VaultActionsDesktop({ vault, hasSupplyPosition }: { hasSupplyPosition: boolean } & VaultActionsProps) {
  const [selection, setSelection] = useState<"supply" | "withdraw">("supply");

  // Default to supply
  useEffect(() => {
    if (!hasSupplyPosition) {
      setSelection("supply");
    }
  }, [hasSupplyPosition]);

  return (
    <div className="relative">
      {hasSupplyPosition && (
        <div className="absolute -top-[16px] flex -translate-y-full gap-2">
          <Button
            variant={selection == "supply" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelection("supply")}
          >
            Supply
          </Button>
          <Button
            variant={selection == "withdraw" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelection("withdraw")}
          >
            Withdraw
          </Button>
        </div>
      )}

      <Card>
        <CardContent>
          {selection == "supply" && <VaultSupply vault={vault} />}
          {selection == "withdraw" && <VaultWithdraw vault={vault} />}
        </CardContent>
      </Card>
    </div>
  );
}

function VaultActionsMobile({ vault, hasSupplyPosition }: { hasSupplyPosition: boolean } & VaultActionsProps) {
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[20] flex items-center gap-[10px] bg-background-primary/15 px-4 py-3 backdrop-blur-lg">
        <Drawer open={supplyOpen} onOpenChange={setSupplyOpen}>
          <DrawerTrigger asChild>
            <Button className="w-full">Supply</Button>
          </DrawerTrigger>
          <DrawerContent>
            <VisuallyHidden>
              <DrawerTitle>Supply to vault</DrawerTitle>
            </VisuallyHidden>
            <VaultSupply vault={vault} onCloseAfterSuccess={() => setSupplyOpen(false)} />
          </DrawerContent>
        </Drawer>

        <Drawer open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DrawerTrigger asChild>
            <Button className="w-full" disabled={!hasSupplyPosition}>
              Withdraw
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <VisuallyHidden>
              <DrawerTitle>Withdraw from vault</DrawerTitle>
            </VisuallyHidden>
            <VaultWithdraw vault={vault} onCloseAfterSuccess={() => setWithdrawOpen(false)} />
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
