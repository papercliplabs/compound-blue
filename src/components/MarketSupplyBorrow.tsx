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
import { prepareMarketSupplyBorrowAction } from "@/actions/prepareMarketSupplyBorrowAction";
import { Hex } from "viem";

interface MarketSupplyBorrowProps {
  marketId: Hex;
  // asset: {
  //   address: Address | string;
  //   symbol: string;
  //   decimals: number;
  //   icon?: string | null;
  //   priceUsd?: number | null;
  // };
}

export default function MarketSupplyBorrow({ marketId }: MarketSupplyBorrowProps) {
  const [open, setOpen] = useState(false);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [transactionRequests, setTransactionRequests] = useState<TransactionRequest[]>([]);

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const handleSubmit = useCallback(async () => {
    if (!address || !publicClient) return;

    const { signatureRequests, transactionRequests } = await prepareMarketSupplyBorrowAction({
      publicClient,
      accountAddress: address,
      marketId: marketId as MarketId,
      supplyCollateralAmount: BigInt(0.01e18), // TODO: get from form
      borrowAmount: BigInt(1e6), // TODO: get from form
      requiresReallocation: false, // TODO
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
      <Button onClick={handleSubmit}>Supply & Borrow</Button>
      <ActionFlowDialog
        open={open}
        onOpenChange={setOpen}
        signatureRequests={signatureRequests}
        transactionRequests={transactionRequests}
      >
        <ActionFlowSummary>SUMMARY</ActionFlowSummary>
        <ActionFlowReview>REVIEW</ActionFlowReview>
        <div className="flex w-full flex-col gap-2">
          <ActionFlowButton>Supply & Borrow</ActionFlowButton>
          <ActionFlowError />
        </div>
      </ActionFlowDialog>
    </div>
  );
}
