"use client";
import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import { UserVaultPositions } from "@/data/whisk/getUserVaultPositions";
import { safeFetch } from "@/utils/fetch";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { UserMarketPositions } from "@/data/whisk/getUserMarketPositions";
import { Address } from "viem";
import { UserTokenHolding } from "@/data/whisk/getUserTokenHolding";

const DEFAULT_POLLING_INTERVAL_MS = 60 * 1000;
const FAST_POLLING_INTERVAL_MS = 3 * 1000;
const FAST_POLLING_TIME_MS = 30 * 1000;

type UserPositionContextType = {
  userVaultPositionsQuery: UseQueryResult<UserVaultPositions | undefined>;
  userMarketPositionsQuery: UseQueryResult<UserMarketPositions | undefined>;

  pollingInterval: number;

  triggerFastPolling: () => void;
};

const UserPositionContext = createContext<UserPositionContextType | undefined>(undefined);

export function UserPositionProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [pollingInterval, setPollingInterval] = useState(DEFAULT_POLLING_INTERVAL_MS);

  const userVaultPositionsQuery = useQuery({
    queryKey: ["user-vault-positions", address],
    queryFn: async () => safeFetch<UserVaultPositions>(`/api/user/${address}/vault-positions`),
    enabled: !!address,
    refetchInterval: pollingInterval,
  });

  const userMarketPositionsQuery = useQuery({
    queryKey: ["user-market-positions", address],
    queryFn: async () => safeFetch<UserMarketPositions>(`/api/user/${address}/market-positions`),
    enabled: !!address,
    refetchInterval: pollingInterval,
  });

  const triggerFastPolling = useCallback(() => {
    setPollingInterval(FAST_POLLING_INTERVAL_MS);

    const timeout = setTimeout(() => {
      setPollingInterval(DEFAULT_POLLING_INTERVAL_MS);
    }, FAST_POLLING_TIME_MS);

    return () => clearTimeout(timeout);
  }, [setPollingInterval]);

  return (
    <UserPositionContext.Provider
      value={{ userVaultPositionsQuery, userMarketPositionsQuery, pollingInterval, triggerFastPolling }}
    >
      {children}
    </UserPositionContext.Provider>
  );
}

export function useUserPositionContext() {
  const context = useContext(UserPositionContext);
  if (!context) {
    throw new Error("useUserPosition must be used within an UserPosition provider");
  }
  return context;
}

export function useUserTokenHolding(tokenAddress: Address) {
  // Same polling interval as positions
  const { pollingInterval } = useUserPositionContext();
  const { address } = useAccount();

  const query = useQuery({
    queryKey: ["user-token-holding", tokenAddress, address],
    queryFn: async () => safeFetch<UserTokenHolding>(`/api/user/${address}/holding/${tokenAddress}`),
    enabled: !!address,
    refetchInterval: pollingInterval,
  });

  return query;
}
