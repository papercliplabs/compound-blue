"use client";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { useTheme } from "@/hooks/useTheme";

import { wagmiConfig } from "./wagmi";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 300_000, // 5 min
      staleTime: 300_000, // 5 min
    },
  },
});

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={
            theme == "light"
              ? lightTheme({
                  accentColor: "rgb(var(--accent-secondary))",
                  accentColorForeground: "rgb(var(--content-primary))",
                  borderRadius: "medium",
                })
              : darkTheme({
                  accentColor: "rgb(var(--accent-secondary))",
                  accentColorForeground: "rgb(var(--content-primary))",
                  borderRadius: "medium",
                })
          }
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
