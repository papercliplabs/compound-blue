"use client";
import { darkTheme, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmi";
import { useTheme } from "@/hooks/useTheme";

const queryClient = new QueryClient();

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
