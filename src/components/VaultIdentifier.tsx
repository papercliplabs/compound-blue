import Image from "next/image";

import { VaultSummary } from "@/data/whisk/getVaultSummaries";

interface VaultIdentifierProps {
  name: VaultSummary["name"];
  metadata: VaultSummary["metadata"];
  asset: Pick<VaultSummary["asset"], "icon" | "symbol">;
}

export function VaultIdentifier({ name, metadata, asset }: VaultIdentifierProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image
        src={metadata?.image ?? asset.icon ?? ""}
        width={36}
        height={36}
        className="shrink-0 rounded-full border"
        alt={name}
      />
      <div className="flex flex-col justify-between">
        <span className="label-lg">{name}</span>
        <div className="flex">
          <span className="text-content-secondary label-sm">{asset.symbol}</span>
          {metadata?.riskTier && (
            <span className="inline whitespace-pre-wrap text-content-secondary label-sm">
              {" "}
              • {metadata.riskTier.slice(0, 1).toUpperCase() + metadata.riskTier.slice(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
