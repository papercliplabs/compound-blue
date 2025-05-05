"use client";
import { ResponsiveProvider } from "./ResponsiveProvider";
import { ThemeProvider } from "./ThemeProvider";
import WalletProvider from "./WalletProvider";
import { AcknowledgeTermsProvider } from "./AcknowledgeTermsProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ResponsiveProvider>
          <AcknowledgeTermsProvider>{children}</AcknowledgeTermsProvider>
        </ResponsiveProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
