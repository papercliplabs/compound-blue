"use client";
import { formatNumber } from "@/utils/format";
import Metric from "../Metric";
import { useAccount } from "wagmi";
import { Hex } from "viem";
import { HTMLAttributes } from "react";
import { cn } from "@/utils/shadcn";

export default function UserMarketPosition({
  className,
  ...props
}: { marketId: Hex } & HTMLAttributes<HTMLDivElement>) {
  const { address } = useAccount();

  // Hidden if not connected, also don't show if no position
  if (!address) {
    return null;
  }

  // TODO: Client side fetch for the users vault portfolio summary
  const userTotalBorrowUsd = undefined;

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      <Metric label={<span className="justify-end text-accent-ternary">Borrowing</span>} description="TODO">
        {userTotalBorrowUsd == undefined ? "--" : formatNumber(userTotalBorrowUsd, { currency: "USD" })}
      </Metric>
      <span>TODO</span>
    </div>
  );
}
