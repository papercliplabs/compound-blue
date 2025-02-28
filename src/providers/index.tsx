"use client";
import { ThemeProvider } from "./ThemeProvider";
import { UserPositionProvider } from "./UserPositionProvider";
import WalletProvider from "./WalletProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <UserPositionProvider>{children}</UserPositionProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
