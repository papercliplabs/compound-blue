"use client";
import {
  ActionFlowButton,
  ActionFlowDialog,
  ActionFlowError,
  ActionFlowReview,
  ActionFlowSummary,
} from "@/components/ActionFlowDialog";
import { useCallback, useState } from "react";
import { Button } from "./ui/button";
import { MarketId } from "@morpho-org/blue-sdk";
import { useAccount, usePublicClient } from "wagmi";
import { SignatureRequest, TransactionRequest } from "./ActionFlowDialog/ActionFlowProvider";
import { Hex } from "viem";
import { prepareMarketRepayWithdrawAction } from "@/actions/prepareMarketRepayWithdrawAction";

interface MarketRepayWithdrawProps {
  marketId: Hex;
  // asset: {
  //   address: Address | string;
  //   symbol: string;
  //   decimals: number;
  //   icon?: string | null;
  //   priceUsd?: number | null;
  // };
}

export default function MarketRepayWithdraw({ marketId }: MarketRepayWithdrawProps) {
  const [open, setOpen] = useState(false);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [transactionRequests, setTransactionRequests] = useState<TransactionRequest[]>([]);

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const handleSubmit = useCallback(async () => {
    if (!address || !publicClient) return;

    const { signatureRequests, transactionRequests } = await prepareMarketRepayWithdrawAction({
      publicClient,
      accountAddress: address,
      marketId: marketId as MarketId,
      repayAmount: BigInt(0), // TODO: get from form
      withdrawCollateralAmount: BigInt(0.001e18), // TODO: get from form
    });

    setSignatureRequests(signatureRequests);
    setTransactionRequests(transactionRequests);

    setOpen(true);
    // TODO: sim bundle, store the output in state, and pass this into the action flow
  }, [publicClient, address, marketId]);

  // TODO: form input + validation
  // On submit: sim bundle, store the output in state, and pass this into the action flow
  return (
    <div>
      <Button onClick={handleSubmit}>Repay & Withdraw</Button>
      <ActionFlowDialog
        open={open}
        onOpenChange={setOpen}
        signatureRequests={signatureRequests}
        transactionRequests={transactionRequests}
      >
        <ActionFlowSummary>SUMMARY</ActionFlowSummary>
        <ActionFlowReview>REVIEW</ActionFlowReview>
        <div className="flex w-full flex-col gap-2">
          <ActionFlowButton>Repay & Withdraw</ActionFlowButton>
          <ActionFlowError />
        </div>
      </ActionFlowDialog>
    </div>
  );
}
