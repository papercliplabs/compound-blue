"use client";
import { UserRewards } from "@/data/whisk/getUserRewards";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Button } from "../ui/button";
import Sparkle from "../ui/icons/Sparkle";
import { useMemo } from "react";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Image from "next/image";

export default function ClaimRewards() {
  const { address } = useAccount();

  const { data } = useQuery({
    queryKey: ["user-rewards", address!],
    queryFn: async () => safeFetch<UserRewards>(`/api/user-rewards/${address}`),
    enabled: !!address,
  });

  const totalRewards = useMemo(
    () => (data ?? []).reduce((acc, curr) => acc + (curr.unclaimedAmountUsd ?? 0), 0),
    [data]
  );

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="border pl-3 pr-4">
          <Sparkle />
          <span>{formatNumber(totalRewards, { currency: "USD" })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex flex-col gap-4">
        <span className="w-full text-center font-medium paragraph-lg">Claimable Rewards</span>
        {data.map((reward, i) => {
          if (!reward.token) {
            return null;
          }

          return (
            <div
              className="flex items-center justify-between rounded-[10px] bg-background-inverse px-6 py-3 font-medium"
              key={i}
            >
              <div className="flex items-center gap-4">
                <Image
                  src={reward.token.icon ?? ""}
                  alt={reward.token.symbol ?? ""}
                  width={36}
                  height={36}
                  className="rounded-full"
                />
                {reward.token.symbol}
              </div>
              <div className="flex h-full flex-col items-end justify-between">
                <span>{formatNumber(descaleBigIntToNumber(reward.unclaimedAmount, reward.token.decimals))}</span>
                <span className="text-content-secondary paragraph-sm">
                  {formatNumber(reward.unclaimedAmountUsd, { currency: "USD" })}
                </span>
              </div>
            </div>
          );
        })}
        <div className="h-[1px] w-full bg-border-primary" />
        <div className="flex w-full items-center justify-between">
          <span>Total rewards</span>
          <span>{formatNumber(totalRewards, { currency: "USD" })}</span>
        </div>
        <Button onClick={() => alert("TODO")}>Claim Rewards</Button>
      </PopoverContent>
    </Popover>
  );
}
