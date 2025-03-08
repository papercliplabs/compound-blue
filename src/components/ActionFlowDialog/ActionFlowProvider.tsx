"use client";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { SignatureRequirementFunction } from "@morpho-org/bundler-sdk-viem";
import { Address, Hex, TransactionRequest as ViemTransactionRequest } from "viem";
import { useAccount, useConnectorClient, usePublicClient, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/config";
import { useChainModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { estimateGas, sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { track } from "@vercel/analytics";
import { useAccountDataPollingContext } from "@/providers/AccountDataPollingProvider";
import { useAccountIsOfacSanctioned } from "@/hooks/useAccountIsOfacSanctioned";
import { revalidateDynamicPages } from "@/utils/revalidateDynamicPages";

export type ActionFlowState = "review" | "active" | "success" | "failed";
export type ActionState = "pending-wallet" | "pending-transaction";

// Gives buffer on gas estimate to help prevent out of gas error
// For wallets that decide to respect this...
const GAS_BUFFER = 0.2;

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
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { data: isOfacSanctioned = true } = useAccountIsOfacSanctioned(); // Default to true while fetching...

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
          throw new Error("Unable to automaitcally switch chains.");
        }
      } catch {
        // Open modal and let the user do it manually
        openChainModal?.();
        return;
      }
    }

    if (flowState == "review") {
      // Reset state
      setFlowState("active");
      //   setActiveStep(0); // Don't reset step, let's pick up where we left off.
      setActionState("pending-wallet");
      setLastTransactionHash(null);
      setError(null);

      // Don't allow any actions if the account is OFAC sanctioned
      if (isOfacSanctioned) {
        setError("This action is not available to OFAC sanctioned accounts.");
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
          const gasEstimate = await estimateGas(client, { ...txReq, account: client.account });
          const gasEstimateWithBuffer = (gasEstimate * BigInt((1 + GAS_BUFFER) * 1000)) / BigInt(1000);
          const hash = await sendTransaction(client, { ...txReq, gas: gasEstimateWithBuffer });
          setLastTransactionHash(hash);
          track("transaction", { hash, status: "pending" });

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

      // Re-fetch dynamic pages next visit since state has updated (default 60s revalidation)
      revalidateDynamicPages();
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
    isOfacSanctioned,
  ]);

  // Trigger polling of user position once the flow is successful
  const { triggerFastPolling } = useAccountDataPollingContext();
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
