"use client";
import { useChainModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import { Hex } from "viem";
import { estimateGas, sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { useAccount, useConnectorClient, usePublicClient, useSwitchChain } from "wagmi";

import { SignatureRequest, TransactionRequest } from "@/actions/utils/types";
import { CHAIN_ID } from "@/config";
import { trackEvent } from "@/data/trackEvent";
import { safeFetch } from "@/utils/fetch";
import { revalidatePages } from "@/utils/revalidatePages";

export type ActionFlowState = "review" | "active" | "success" | "failed";
export type ActionState = "pending-wallet" | "pending-transaction";

// Gives buffer on gas estimate to help prevent out of gas error
// For wallets that decide to respect this...
const GAS_BUFFER = 0.3;

// Upper bound for all actions, used when a gas estimate fails to still allow tx to proceed (still <$0.02)
const FALLBACK_GAS_ESTIMATE = BigInt(1_200_000);

type ActionFlowContextType = {
  flowState: ActionFlowState;
  activeStep: number;
  actionState: ActionState;

  lastTransactionHash: Hex | null;
  error: string | null;

  signatureRequests: SignatureRequest[];
  transactionRequests: TransactionRequest[];

  startFlow: () => void;
};

const ActionFlowContext = createContext<ActionFlowContextType | undefined>(undefined);

interface ActionFlowProviderProps {
  signatureRequests: SignatureRequest[];
  transactionRequests: TransactionRequest[];
  flowCompletionCb?: () => void;
  children: ReactNode;
}

export function ActionFlowProvider({
  children,
  flowCompletionCb,
  signatureRequests,
  transactionRequests,
}: ActionFlowProviderProps) {
  const [flowState, setFlowState] = useState<ActionFlowState>("review");
  const [activeStep, setActiveStep] = useState<number>(0);
  const [actionState, setActionState] = useState<ActionState>("pending-wallet");
  const [lastTransactionHash, setLastTransactionHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { chainId } = useAccount();
  const { data: client } = useConnectorClient();
  const { connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  const startFlow = useCallback(async () => {
    // Must be connected
    if (!client || !publicClient) {
      openConnectModal?.();
      return;
    }

    // Must be on the correct chain
    if (chainId != CHAIN_ID) {
      try {
        // Try to automatically switch chain
        const { id } = await switchChainAsync({ chainId: CHAIN_ID });
        if (id != CHAIN_ID) {
          throw new Error("Unable to automatically switch chains.");
        }
      } catch {
        // Open modal and let the user do it manually
        openChainModal?.();
        return;
      }
    }

    if (flowState == "review") {
      // For tracking purposes to determine if we are seeing issues with a specific connector
      const connectorName = connector?.name ?? "unknown";

      // Reset state
      setFlowState("active");
      //   setActiveStep(0); // Don't reset step, let's pick up where we left off.
      setActionState("pending-wallet");
      setLastTransactionHash(null);
      setError(null);

      const isOfacSanctioned = await safeFetch<boolean>(`/api/account/${client.account.address}/is-ofac-sanctioned`);
      if (isOfacSanctioned) {
        setError("This action is not available to OFAC sanctioned accounts.");
        setFlowState("review");
        return;
      }

      try {
        for (const step of signatureRequests) {
          await step.sign(client);
          setActiveStep((step) => step + 1);
        }

        for (const step of transactionRequests) {
          setActionState("pending-wallet");

          const txReq = step.tx();

          let gasEstimateWithBuffer: bigint;
          try {
            // Uses public client instead so estimate happens throught our reliable RPC provider
            const gasEstimate = await estimateGas(publicClient, { ...txReq, account: client.account });
            gasEstimateWithBuffer = (gasEstimate * BigInt((1 + GAS_BUFFER) * 1000)) / BigInt(1000);
          } catch (error) {
            // Should never really happen, but if it does let's let the user try to proceed with fallback, and track it
            const errorMessage = error instanceof Error ? error.message : String(error);
            gasEstimateWithBuffer = FALLBACK_GAS_ESTIMATE;
            void trackEvent("tx-gas-estimate-failed", {
              accountAddress: client.account.address,
              connector: connectorName,
              error: errorMessage,
              stepName: step.name,
            });
          }

          const hash = await sendTransaction(client, { ...txReq, gas: gasEstimateWithBuffer });
          setLastTransactionHash(hash);
          void trackEvent("transaction", { hash, status: "pending", connector: connectorName, name: step.name });

          // Uses public client instead so polling happens through our RPC provider
          // Not the users wallet provider, which may be unreliable
          setActionState("pending-transaction");
          const receipt = await waitForTransactionReceipt(publicClient, {
            hash,
            // TODO: handle replacement (?)
            onReplaced: (replacement) => console.log("TX REPLACED", replacement),
            pollingInterval: 4000,
            retryCount: 20,
          });

          if (receipt.status == "success") {
            void trackEvent("transaction", { hash, status: "success", connector: connectorName, name: step.name });
            setActiveStep((step) => step + 1);

            // Trigger data revalidation
            void revalidatePages();
            void queryClient.invalidateQueries({ type: "all" });
            void queryClient.refetchQueries({ type: "all" });
          } else {
            void trackEvent("transaction", { hash, status: "failed", connector: connectorName, name: step.name });
            setFlowState("failed");
            return;
          }
        }
      } catch (error) {
        // TODO: Parse this error
        const errorMessage = error instanceof Error ? error.message : String(error);
        setError(errorMessage);
        setFlowState("review");
        void trackEvent("transaction-flow-error", {
          accountAddress: client.account.address,
          connector: connectorName,
          error: errorMessage,
        });
        return;
      }

      setFlowState("success");
      flowCompletionCb?.();
    }
  }, [
    flowState,
    setFlowState,
    setActionState,
    setActiveStep,
    setLastTransactionHash,
    setError,
    client,
    publicClient,
    chainId,
    signatureRequests,
    transactionRequests,
    openChainModal,
    openConnectModal,
    flowCompletionCb,
    switchChainAsync,
    connector,
    queryClient,
  ]);

  return (
    <ActionFlowContext.Provider
      value={{
        flowState,
        activeStep,
        actionState,
        lastTransactionHash,
        error,
        startFlow,
        signatureRequests,
        transactionRequests,
      }}
    >
      {children}
    </ActionFlowContext.Provider>
  );
}

export function useActionFlowContext() {
  const context = useContext(ActionFlowContext);
  if (!context) {
    throw new Error("useActionFlow must be used within an ActionFlow provider");
  }
  return context;
}
