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
import { usePopulatedSimulationState } from "@/hooks/usePopulatedSimulationState";
import { encodeBundle, finalizeBundle, populateBundle } from "@morpho-org/bundler-sdk-viem";
import { Address, DEFAULT_SLIPPAGE_TOLERANCE } from "@morpho-org/blue-sdk";
import { useAccount } from "wagmi";
import { SignatureRequest, TransactionRequest } from "./ActionFlowDialog/ActionFlowProvider";
import { getAddress } from "viem";

interface VaultSupplyProps {
  vaultAddress: Address;
  asset: {
    address: Address | string;
    symbol: string;
    decimals: number;
    icon?: string | null;
    priceUsd?: number | null;
  };
}

export default function VaultSupply({ vaultAddress, asset }: VaultSupplyProps) {
  const [open, setOpen] = useState(false);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [transactionRequests, setTransactionRequests] = useState<TransactionRequest[]>([]);

  const { address } = useAccount();
  const { simulationState } = usePopulatedSimulationState({
    type: "vault-supply",
    vaultAddress,
    tokenAddresses: [getAddress(asset.address)],
  });

  console.log("SIM", simulationState);

  const handleSubmit = useCallback(async () => {
    if (!simulationState || !address) return;

    let { operations } = populateBundle(
      [
        {
          type: "MetaMorpho_Deposit",
          sender: address,
          address: vaultAddress,
          args: {
            assets: BigInt(1e6),
            owner: address,
            slippage: DEFAULT_SLIPPAGE_TOLERANCE,
          },
        },
        // {
        //   type: "MetaMorpho_Withdraw",
        //   sender: address,
        //   address: vaultAddress,
        //   args: {
        //     assets: BigInt(0.1e6),
        //     owner: address,
        //     receiver: address,
        //     slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        //   },
        // },
        // {
        //   type: "Blue_Supply",
        //   sender: address,
        //   address: morpho,
        //   args: {
        //     id: "0x88a2953e642f96afcb8d8ba2a1cc2e732e9ba89bb99eecf2d6101ad558ab7698" as MarketId,
        //     assets: BigInt(1),
        //     onBehalf: address,
        //     slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        //   },
        // },
      ],
      simulationState,
      {}
    );
    console.log("DEBUG - raw ops", operations);

    operations = finalizeBundle(operations, simulationState, address);

    const bundle = encodeBundle(operations, simulationState);
    console.log("DEBUG - bundle", bundle);

    setSignatureRequests(bundle.requirements.signatures.map((sig) => ({ sign: sig.sign, name: "TODO" })));
    setTransactionRequests(
      bundle.requirements.txs
        .map((tx) => ({ tx: () => tx.tx, name: "TODO" }))
        .concat([
          {
            tx: bundle.tx,
            name: "Finalize",
          },
        ])
    );

    setOpen(true);
    // TODO: sim bundle, store the output in state, and pass this into the action flow
  }, [simulationState, address, vaultAddress]);

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
        // transactionRequests={[
        //   {
        //     name: "Approve POL",
        //     tx: () => ({
        //       to: "0xD11C5194EfEF0b836277EA149cfe23d178b60242",
        //       data: "0x",
        //       value: BigInt(1),
        //     }),
        //   },
        //   {
        //     name: "Confirm Borrow",
        //     tx: () => ({
        //       to: "0xD11C5194EfEF0b836277EA149cfe23d178b60242",
        //       data: "0x",
        //       value: BigInt(1),
        //     }),
        //   },
        // ]}
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
