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
import { Address } from "@morpho-org/blue-sdk";
import { useAccount, usePublicClient } from "wagmi";
import { SignatureRequest, TransactionRequest } from "./ActionFlowDialog/ActionFlowProvider";
import { prepareVaultSupplyBundle } from "@/actions/prepareVaultSupplyAction";

interface VaultSupplyProps {
  vaultAddress: Address;
  // asset: {
  //   address: Address | string;
  //   symbol: string;
  //   decimals: number;
  //   icon?: string | null;
  //   priceUsd?: number | null;
  // };
}

export default function VaultSupply({ vaultAddress }: VaultSupplyProps) {
  const [open, setOpen] = useState(false);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [transactionRequests, setTransactionRequests] = useState<TransactionRequest[]>([]);

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const handleSubmit = useCallback(async () => {
    if (!address || !publicClient) return;

    const { signatureRequests, transactionRequests } = await prepareVaultSupplyBundle({
      publicClient,
      accountAddress: address,
      vaultAddress,
      supplyAmount: BigInt(0.1e6), // TODO: get from form
    });

    setSignatureRequests(signatureRequests);
    setTransactionRequests(transactionRequests);

    setOpen(true);
    // TODO: sim bundle, store the output in state, and pass this into the action flow
  }, [publicClient, address, vaultAddress]);

  // TODO: form input + validation
  // On submit: sim bundle, store the output in state, and pass this into the action flow
  return (
    <div>
      <Button onClick={handleSubmit}>Supply</Button>
      <ActionFlowDialog
        open={open}
        onOpenChange={setOpen}
        signatureRequests={signatureRequests}
        transactionRequests={transactionRequests}
      >
        <ActionFlowSummary>SUMMARY</ActionFlowSummary>
        <ActionFlowReview>REVIEW</ActionFlowReview>
        <div className="flex w-full flex-col gap-2">
          <ActionFlowButton>Supply</ActionFlowButton>
          <ActionFlowError />
        </div>
      </ActionFlowDialog>
    </div>
  );
}
