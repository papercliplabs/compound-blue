"use client";
import { darkTheme, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { wagmiConfig } from "./wagmi";

const queryClient = new QueryClient();

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  // Prevent hydration error from theme...
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isLight = useMemo(() => theme === "light" && mounted, [theme, mounted]);

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
