"use client";

import { formatNumber } from "@/utils/format";
import Metric from "../Metric";
import { useAccount } from "wagmi";

export default function UserMarketSummary() {
  const { address } = useAccount();

  // Hidden if not connected
  if (!address) {
    return null;
  }

  // TODO: Client side fetch for the users vault portfolio summary
  const userTotalBorrowUsd = undefined;
  const userAvgApy = undefined;

  return (
    <div className="flex gap-12">
      <Metric label={<span className="text-accent-ternary">Borrowing</span>} description="TODO">
        {userTotalBorrowUsd == undefined ? "--" : formatNumber(userTotalBorrowUsd, { currency: "USD" })}
      </Metric>
      <Metric label="Avg. Borrow APY" description="TODO">
        {userAvgApy == undefined ? "--" : formatNumber(userAvgApy, { style: "percent" })}
      </Metric>
    </div>
  );
}
