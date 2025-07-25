"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Address, Hex, getAddress } from "viem";
import { useAccount } from "wagmi";

import { merklClaimAction } from "@/actions/rewards/merklClaimAction";
import { useAccountRewards } from "@/hooks/useAccountRewards";
import { useTheme } from "@/hooks/useTheme";
import { formatNumber } from "@/utils/format";

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
                  rawAmount={BigInt(reward.unclaimedAmount)}
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
