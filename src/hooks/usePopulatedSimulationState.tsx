"use client";
import { CHAIN_ID } from "@/config";
import { addresses, MarketId } from "@morpho-org/blue-sdk";
import { SimulationStateLike, useSimulationState } from "@morpho-org/simulation-sdk-wagmi";
import { useMemo } from "react";
import { Address, ReadContractErrorType } from "viem";
import { useAccount, useBlock, useChainId } from "wagmi";

type UsePopulatedSimulationStateParams = {
  tokenAddresses: Address[]; // TODO: can fetch this based on the vault or market instead...
} & (
  | {
      type: "vault-supply" | "vault-withdraw";
      vaultAddress: Address;
    }
  | {
      type: "market-borrow" | "market-repay";
      marketId: MarketId;
    }
);

const { bundler3 } = addresses[CHAIN_ID];

/* eslint-disable @typescript-eslint/no-explicit-any */
const hasNonNullLeafValue = (obj: any): boolean => {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== "object") return true;

  return Object.values(obj).some((value) => hasNonNullLeafValue(value));
};

const getSimulationErrorMessage = (error: SimulationStateLike<ReadContractErrorType | null>): string | null => {
  if (!error) return null;
  if (error instanceof Error) return error.message;

  const hasRealError = hasNonNullLeafValue(error);
  return hasRealError ? JSON.stringify(error, null, 2) : null;
};

// Pass in the token addresses to be used as part of the simulation
export function usePopulatedSimulationState(params: UsePopulatedSimulationStateParams) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { data: block } = useBlock({ watch: false }); // TODO: watch

  // Minimal config for each action to reduce overfetching
  const { vaultAddresses, marketIds }: { vaultAddresses: Address[]; marketIds: MarketId[] } = useMemo(() => {
    switch (params.type) {
      case "vault-supply":
      case "vault-withdraw":
        return { vaultAddresses: [params.vaultAddress], marketIds: [] };
      case "market-repay":
        return { vaultAddresses: [], marketIds: [params.marketId] };
      case "market-borrow":
        // TODO: need all vaults supplying to this market, and all their markets for public allocator...
        return { vaultAddresses: [], marketIds: [] };
    }
  }, [params]);

  let simulation;
  try {
    simulation = useSimulationState({
      chainId,
      block: {
        number: block?.number ?? BigInt(0),
        timestamp: block?.timestamp ?? BigInt(0),
      },
      vaults: vaultAddresses,
      marketIds,
      users: [address, bundler3.generalAdapter1, ...vaultAddresses],
      tokens: [...params.tokenAddresses, ...vaultAddresses],
      query: {
        enabled: !!address && !!block,
      },
    });

    const errorMessage = getSimulationErrorMessage(simulation.error);
    if (errorMessage) {
      console.error("Simulation error details:", {
        error: simulation.error,
        errorMessage,
      });
    }
  } catch (error) {
    console.error("Error in useSimulationState:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  return { simulationState: simulation.data, error: getSimulationErrorMessage(simulation.error) };
}
