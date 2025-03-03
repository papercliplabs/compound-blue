"use client";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { SignatureRequirementFunction } from "@morpho-org/bundler-sdk-viem";
import { Address, Hex, TransactionRequest as ViemTransactionRequest } from "viem";
import { useAccount, useConnectorClient } from "wagmi";
import { CHAIN_ID } from "@/config";
import { useChainModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { useUserPositionContext } from "@/providers/UserPositionProvider";
import { track } from "@vercel/analytics";

export type ActionFlowState = "review" | "active" | "success" | "failed";
export type ActionState = "pending-wallet" | "pending-transaction";

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

interface ActionMetadata {
  name: string;
  //   iconSrc: string;
  learnMore?: {
    label: string;
    href: string;
  };
}

export interface SignatureRequest extends ActionMetadata {
  sign: SignatureRequirementFunction;
}

export interface TransactionRequest extends ActionMetadata {
  tx: () => ViemTransactionRequest & {
    to: Address;
    data: Hex;
  };
}

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
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();

  const startFlow = useCallback(async () => {
    // Must be connected
    if (!client) {
      openConnectModal?.();
      return;
    }

    // Must be on the correct chain
    if (chainId != CHAIN_ID) {
      openChainModal?.();
      return;
    }

    if (flowState == "review") {
      // Reset state
      setFlowState("active");
      //   setActiveStep(0); // Don't reset step, let's pick up where we left off.
      setActionState("pending-wallet");
      setLastTransactionHash(null);
      setError(null);

      try {
        for (const step of signatureRequests) {
          await step.sign(client);
          setActiveStep((step) => step + 1);
        }

        for (const step of transactionRequests) {
          setActionState("pending-wallet");
          const hash = await sendTransaction(client, step.tx());
          setLastTransactionHash(hash);
          track("transaction", { hash, status: "pending" });

          setActionState("pending-transaction");
          const receipt = await waitForTransactionReceipt(client, {
            hash,
            // TODO: handle replacement (?)
            onReplaced: (replacement) => console.log("TX REPLACED", replacement),
            pollingInterval: 4000,
            retryCount: 10,
          });

          if (receipt.status == "success") {
            track("transaction", { hash, status: "success" });
            setActiveStep((step) => step + 1);
          } else {
            track("transaction", { hash, status: "failed" });
            setFlowState("failed");
            return;
          }
        }
      } catch (error) {
        // TODO: Parse this error
        setError(error instanceof Error ? error.message : String(error));
        setFlowState("review");
        return;
      }

      flowCompletionCb?.();
      setFlowState("success");
    }
  }, [
    flowState,
    setFlowState,
    setActionState,
    setActiveStep,
    setLastTransactionHash,
    setError,
    client,
    chainId,
    signatureRequests,
    transactionRequests,
    openChainModal,
    openConnectModal,
    flowCompletionCb,
  ]);

  // Trigger polling of user position once the flow is successful
  const { triggerFastPolling } = useUserPositionContext();
  useEffect(() => {
    if (flowState == "success") {
      triggerFastPolling();
    }
  }, [flowState, triggerFastPolling]);

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
