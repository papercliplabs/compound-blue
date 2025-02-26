"use client";

import { formatNumber } from "@/utils/format";
import Metric from "../Metric";
import { useAccount } from "wagmi";
import { Address } from "viem";
import { HTMLAttributes } from "react";
import { cn } from "@/utils/shadcn";

export default function UserVaultPosition({
  className,
  ...props
}: { vaultAddress: Address } & HTMLAttributes<HTMLDivElement>) {
  const { address } = useAccount();

  // Hidden if not connected, also don't show if no position
  if (!address) {
    return null;
  }

  // TODO: Client side fetch for the users vault portfolio summary
  const userTotalSuppliedUsd = undefined;

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      <Metric label={<span className="justify-end text-accent-secondary">Supplying</span>} description="TODO">
        {userTotalSuppliedUsd == undefined ? "--" : formatNumber(userTotalSuppliedUsd, { currency: "USD" })}
      </Metric>
      <span>TODO</span>
    </div>
  );
}
