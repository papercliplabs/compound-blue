"use client";
import { TriangleAlert } from "lucide-react";
import { useMemo } from "react";

import { useAaveV3MarketPosition } from "@/hooks/useAaveV3MarketPosition";

const USD_WARNING_THRESHOLD = 0.5;

export function ProtocolMigratorWarningBanner() {
  const { data: position } = useAaveV3MarketPosition();

  const showWarning = useMemo(() => {
    for (const p of position?.reservePositions ?? []) {
      if (
        (p.aTokenAssetsUsd > 0 && p.aTokenAssetsUsd < USD_WARNING_THRESHOLD) ||
        (p.borrowAssetsUsd > 0 && p.borrowAssetsUsd < USD_WARNING_THRESHOLD)
      ) {
        return true;
      }
    }

    return false;
  }, [position]);

  return (
    <>
      {showWarning && (
        <div className="flex gap-2.5 rounded-[7px] bg-background-warning p-4 text-semantic-warning paragraph-sm">
          <TriangleAlert size={16} className="mt-1 shrink-0" />
          <p>
            Small position balances (under $0.50) may cause migration simulation errors. It is recommended to clear any
            leftover &quot;dust&quot; from your Aave position before continuing.
          </p>
        </div>
      )}
    </>
  );
}
