"use client";
import { descaleBigIntToNumber } from "@/utils/format";
import { Address } from "viem";
import { useUserPositionContext } from "@/providers/UserPositionProvider";
import { useMemo } from "react";
import { Skeleton } from "./ui/skeleton";
import Metric from "./Metric";
import { useAccount } from "wagmi";
import Image from "next/image";
import NumberFlow from "./ui/NumberFlow";
import Apy from "./Apy";

interface VaultPositionProps {
  vaultAddress: Address;
}

export function UserVaultPosition({ vaultAddress }: VaultPositionProps) {
  const {
    userVaultPositionsQuery: { data: userVaultPositions, isLoading },
  } = useUserPositionContext();

  const vaultPosition = useMemo(() => {
    return userVaultPositions?.[vaultAddress];
  }, [userVaultPositions, vaultAddress]);

  return (
    <>
      <div className="flex w-full justify-between font-semibold">
        <span>Supplied</span>
        <span>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <NumberFlow value={vaultPosition?.supplyAssetsUsd ?? 0} format={{ currency: "USD" }} />
          )}
        </span>
      </div>
      <div className="flex w-full justify-between font-semibold">
        <span>Apy</span>
        <span>
          {isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : vaultPosition?.supplyApy != undefined ? (
            <Apy type="supply" apy={vaultPosition.supplyApy} className="gap-1" />
          ) : (
            "0.00%"
          )}
        </span>
      </div>
    </>
  );
}

export function UserVaultPositionHighlight({ vaultAddress }: VaultPositionProps) {
  const { address } = useAccount();
  const {
    userVaultPositionsQuery: { data: userVaultPositions },
  } = useUserPositionContext();

  const vaultPosition = useMemo(() => {
    return userVaultPositions?.[vaultAddress];
  }, [userVaultPositions, vaultAddress]);

  // Hide if not connected
  if (!address || !vaultPosition) {
    return null;
  }

  return (
    <div className="flex flex-col md:items-end md:text-end">
      <Metric label={<span className="justify-end text-accent-secondary">Supplying</span>} description="TODO">
        <span className="title-3">
          <NumberFlow value={vaultPosition.supplyAssetsUsd} format={{ currency: "USD" }} />
        </span>
      </Metric>
      <div className="flex items-center gap-1 font-semibold text-content-secondary paragraph-sm">
        {vaultPosition.asset.icon && (
          <Image
            src={vaultPosition.asset.icon}
            width={12}
            height={12}
            alt={vaultPosition.asset.symbol}
            className="rounded-full"
          />
        )}
        <NumberFlow value={descaleBigIntToNumber(BigInt(vaultPosition.supplyAssets), vaultPosition.asset.decimals)} />
      </div>
    </div>
  );
}

export function UserVaultPositionAggregate() {
  const { address } = useAccount();
  const {
    userVaultPositionsQuery: { data: userVaultPositions },
  } = useUserPositionContext();

  const { totalSupplyUsd, avgApy } = useMemo(() => {
    const { totalSupplyUsd, avgApy } = Object.values(userVaultPositions ?? {}).reduce(
      (acc, vaultPosition) => {
        return {
          totalSupplyUsd: acc.totalSupplyUsd + vaultPosition.supplyAssetsUsd,
          avgApy: acc.avgApy + vaultPosition.supplyApy.total * vaultPosition.supplyAssetsUsd,
        };
      },
      { totalSupplyUsd: 0, avgApy: 0 }
    );

    return {
      totalSupplyUsd,
      avgApy: totalSupplyUsd > 0 ? avgApy / totalSupplyUsd : 0,
    };
  }, [userVaultPositions]);

  // Hide if not connected
  if (!address) {
    return null;
  }

  return (
    <div className="flex gap-10 md:text-end">
      <Metric label={<span className="justify-end text-accent-secondary">Your Deposits</span>} description="TODO">
        <span className="title-3">
          <NumberFlow value={totalSupplyUsd} format={{ currency: "USD" }} />
        </span>
      </Metric>

      <Metric label={<span className="justify-end">Avg. Earn APY</span>} description="TODO">
        <span className="title-3">
          <NumberFlow value={avgApy} format={{ style: "percent" }} />
        </span>
      </Metric>
    </div>
  );
}
