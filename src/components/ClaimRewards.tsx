"use client";
import { UserRewards } from "@/data/whisk/getUserRewards";
import { safeFetch } from "@/utils/fetch";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Button } from "./ui/button";
import Sparkle from "./ui/icons/Sparkle";
import { useMemo, useState } from "react";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";
import { ActionFlowError } from "./ActionFlowDialog";
import { ActionFlowButton } from "./ActionFlowDialog";
import { ActionFlowReview } from "./ActionFlowDialog/ActionFlowReview";
import { ActionFlowSummaryAssetItem } from "./ActionFlowDialog/ActionFlowSummary";
import { ActionFlowSummary } from "./ActionFlowDialog/ActionFlowSummary";
import { ActionFlowDialog } from "./ActionFlowDialog";
import { Address, getAddress, Hex } from "viem";
import { prepareMerklClaimAction } from "@/actions/prepareMerklClaimAction";

export default function ClaimRewards() {
  const [open, setOpen] = useState(false);
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

  const preparedAction = useMemo(() => {
    if (!data || !address) {
      return null;
    }

    const tokens: Address[] = [];
    const amounts: bigint[] = [];
    const proofs: Hex[][] = [];

    for (const reward of data) {
      if (reward.token) {
        tokens.push(getAddress(reward.token.address));
        amounts.push(BigInt(reward.amount));
        proofs.push(reward.proof as Hex[]);
      }
    }

    return prepareMerklClaimAction({ accountAddress: address, tokens, amounts, proofs });
  }, [data, address]);

  if (!data || data.length === 0 || totalRewards < 0.01) {
    return null;
  }

  return (
    <>
      <Button variant="secondary" className="border pl-3 pr-4" onClick={() => setOpen(true)}>
        <Sparkle />
        <span>{formatNumber(totalRewards, { currency: "USD" })}</span>
      </Button>

      {preparedAction?.status === "success" && (
        <ActionFlowDialog
          open={open}
          onOpenChange={setOpen}
          signatureRequests={preparedAction.signatureRequests}
          transactionRequests={preparedAction.transactionRequests}
        >
          <ActionFlowSummary>
            {data.map((reward, i) => {
              if (!reward.token || reward.unclaimedAmountUsd < 0.005) {
                return null;
              }

              return (
                <ActionFlowSummaryAssetItem
                  key={i}
                  asset={reward.token}
                  actionName="Claim"
                  descaledAmount={descaleBigIntToNumber(reward.unclaimedAmount, reward.token.decimals)}
                  amountUsd={reward.unclaimedAmountUsd}
                />
              );
            })}
          </ActionFlowSummary>
          <ActionFlowReview>
            <div className="flex w-full items-center justify-between">
              <span>Claim tokens</span>
              <span>{formatNumber(totalRewards, { currency: "USD" })}</span>
            </div>
          </ActionFlowReview>
          <div className="flex w-full flex-col gap-2">
            <ActionFlowButton>Claim</ActionFlowButton>
            <ActionFlowError />
          </div>
          {/* <div>MERKLE LOGO</div> */}
        </ActionFlowDialog>
      )}
    </>
  );
}
