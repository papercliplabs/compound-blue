"use client";
import { darkTheme, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmi";
import { useTheme } from "next-themes";

const queryClient = new QueryClient();

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={
            isLight
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
