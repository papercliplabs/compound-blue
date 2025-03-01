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

export interface VaultActionsProps {
  vault: Vault;
}

export default function VaultActions({ vault }: VaultActionsProps) {
  const [selection, setSelection] = useState<"supply" | "withdraw">("supply");
  const { data: userVaultPosition } = useUserVaultPosition(getAddress(vault.vaultAddress));

  // Only if the user has a position to withdraw
  const shouldShowSelector = useMemo(() => {
    return BigInt(userVaultPosition?.supplyAssets ?? 0) > BigInt(0);
  }, [userVaultPosition]);

  // Default to supply
  useEffect(() => {
    if (!shouldShowSelector) {
      setSelection("supply");
    }
  }, [shouldShowSelector]);

  return (
    <div className="relative">
      {shouldShowSelector && (
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
