"use client";
import { ResponsiveProvider } from "./ResponsiveProvider";
import { ThemeProvider } from "./ThemeProvider";
import { AccountDataPollingProvider } from "./AccountDataPollingProvider";
import WalletProvider from "./WalletProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <AccountDataPollingProvider>
          <ResponsiveProvider>{children}</ResponsiveProvider>
        </AccountDataPollingProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
