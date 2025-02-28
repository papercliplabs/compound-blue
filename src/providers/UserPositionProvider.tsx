"use client";
import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import { UserVaultPositions } from "@/data/whisk/getUserVaultPosition";
import { safeFetch } from "@/utils/fetch";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { UserMarketPositions } from "@/data/whisk/getUserMarketPosition";

const POLLING_TIME_S = 30;
const POLL_INTERVAL_S = 3;

type UserPositionContextType = {
  userVaultPositionsQuery: UseQueryResult<UserVaultPositions | undefined>;
  userMarketPositionsQuery: UseQueryResult<UserMarketPositions | undefined>;

  triggerPolling: () => void;
};

const UserPositionContext = createContext<UserPositionContextType | undefined>(undefined);

export function UserPositionProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [shouldPoll, setShouldPoll] = useState(false);

  const userVaultPositionsQuery = useQuery({
    queryKey: ["user-vault-positions", address],
    queryFn: async () => safeFetch<UserVaultPositions>(`/api/user-positions/vault/${address}`),
    enabled: !!address,
    refetchInterval: shouldPoll ? POLL_INTERVAL_S * 1000 : false,
  });

  const userMarketPositionsQuery = useQuery({
    queryKey: ["user-market-positions", address],
    queryFn: async () => safeFetch<UserMarketPositions>(`/api/user-positions/market/${address}`),
    enabled: !!address,
    refetchInterval: shouldPoll ? POLL_INTERVAL_S * 1000 : false,
  });

  const triggerPolling = useCallback(() => {
    setShouldPoll(true);

    const timeout = setTimeout(() => {
      setShouldPoll(false);
    }, POLLING_TIME_S * 1000);

    return () => clearTimeout(timeout);
  }, [setShouldPoll]);

  return (
    <UserPositionContext.Provider value={{ userVaultPositionsQuery, userMarketPositionsQuery, triggerPolling }}>
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
