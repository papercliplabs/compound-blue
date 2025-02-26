"use client";

import { formatNumber } from "@/utils/format";
import Metric from "../Metric";
import { useAccount } from "wagmi";

export default function UserVaultSummary() {
  const { address } = useAccount();

  // Hidden if not connected
  if (!address) {
    return null;
  }

  // TODO: Client side fetch for the users vault portfolio summary
  const userTotalSupplyingUsd = undefined;
  const userAvgApy = undefined;

  return (
    <div className="flex gap-12">
      <Metric label={<span className="text-accent-secondary">Supplying</span>} description="TODO">
        {userTotalSupplyingUsd == undefined ? "--" : formatNumber(userTotalSupplyingUsd, { currency: "USD" })}
      </Metric>
      <Metric label="Avg. Supply APY" description="TODO">
        {userAvgApy == undefined ? "--" : formatNumber(userAvgApy, { style: "percent" })}
      </Metric>
    </div>
  );
}
