"use client";
import { ResponsiveProvider } from "./ResponsiveProvider";
import { ThemeProvider } from "./ThemeProvider";
import { AccountDataPollingProvider } from "./AccountDataPollingProvider";
import WalletProvider from "./WalletProvider";
import { AcknowledgeTermsProvider } from "./AcknowledgeTermsProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <AccountDataPollingProvider>
          <ResponsiveProvider>
            <AcknowledgeTermsProvider>{children}</AcknowledgeTermsProvider>
          </ResponsiveProvider>
        </AccountDataPollingProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
