"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Address, Hex, getAddress } from "viem";
import { useAccount } from "wagmi";

import { merklClaimAction } from "@/actions/rewards/merklClaimAction";
import { Action } from "@/actions/utils/types";
import { AccountRewards } from "@/data/whisk/getAccountRewards";
import { useAccountRewards } from "@/hooks/useAccountRewards";
import { useTheme } from "@/hooks/useTheme";
import { descaleBigIntToNumber, formatNumber } from "@/utils/format";

import { ActionFlowButton } from "./ActionFlowDialog";
import { ActionFlowDialog } from "./ActionFlowDialog";
import { ActionFlowReview } from "./ActionFlowDialog/ActionFlowReview";
import { ActionFlowSummary } from "./ActionFlowDialog/ActionFlowSummary";
import { ActionFlowSummaryAssetItem } from "./ActionFlowDialog/ActionFlowSummary";
import LinkExternal from "./LinkExternal";
import { Button } from "./ui/button";
import Sparkle from "./ui/icons/Sparkle";
import NumberFlow from "./ui/NumberFlow";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

export default function ClaimRewards() {
  const [claimFlowOpen, setClaimFlowOpen] = useState(false);
  const [noRewardsPopoverOpen, setNoRewardsPopoverOpen] = useState(false);
  const { address } = useAccount();
  const { theme } = useTheme();
  const { data } = useAccountRewards();
  const [claimed, setClaimed] = useState(false);

  const totalRewards = useMemo(() => {
    const total = claimed ? 0 : (data ?? []).reduce((acc, curr) => acc + (curr.unclaimedAmountUsd ?? 0), 0);
    return total;
  }, [data, claimed]);

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

    return merklClaimAction({ accountAddress: address, tokens, amounts, proofs });
  }, [data, address]);

  // Hide if the user is not connected
  if (!address) {
    return null;
  }

  return (
    <>
      <Popover open={noRewardsPopoverOpen} onOpenChange={setNoRewardsPopoverOpen}>
        <PopoverAnchor>
          <Button
            variant="secondary"
            className="border pl-3 pr-4"
            onClick={() => (totalRewards > 0 ? setClaimFlowOpen(true) : setNoRewardsPopoverOpen(true))}
          >
            <Sparkle />
            <NumberFlow value={totalRewards} format={{ currency: "USD" }} />
          </Button>
        </PopoverAnchor>
        <PopoverContent>
          You currently have no unclaimed rewards. Rewards are allocated daily, check back tomorrow!
        </PopoverContent>
      </Popover>

      {data && preparedAction?.status === "success" && (
        <ActionFlowDialog
          open={claimFlowOpen}
          onOpenChange={setClaimFlowOpen}
          signatureRequests={preparedAction.signatureRequests}
          transactionRequests={preparedAction.transactionRequests}
          footerImage={
            <LinkExternal href="https://app.merkl.xyz/" hideArrow>
              <Image
                src={theme === "dark" ? "/merkl-dark.svg" : "/merkl-light.svg"}
                alt="Merkl"
                width={235}
                height={24}
              />
            </LinkExternal>
          }
          flowCompletionCb={() => setClaimed(true)}
          trackingPayload={getTrackingPayload(data, preparedAction, "claim-rewards")}
        >
          <ActionFlowSummary>
            {data.map((reward, i) => {
              if (!reward.token) {
                return null;
              }

              return (
                <ActionFlowSummaryAssetItem
                  key={i}
                  asset={reward.token}
                  actionName="Claim"
                  side="supply"
                  isIncreasing={true}
                  descaledAmount={descaleBigIntToNumber(reward.unclaimedAmount, reward.token.decimals)}
                  amountUsd={reward.unclaimedAmountUsd ?? 0}
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
          <ActionFlowButton>Claim</ActionFlowButton>
        </ActionFlowDialog>
      )}
    </>
  );
}

function getTrackingPayload(rewards: AccountRewards, action: Action | null, tag: string) {
  const basePayload = {
    tag,
  };

  if (!action || action.status !== "success") {
    return basePayload;
  }

  const claimAmount = rewards.reduce((acc, reward) => {
    if (!reward.token || !reward.unclaimedAmountUsd) {
      return 0;
    }

    return acc + reward.unclaimedAmountUsd;
  }, 0);

  return {
    ...basePayload,
    amount: Math.abs(claimAmount),
  };
}
