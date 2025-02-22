"use client";

import WalletProvider from "./WalletProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
    return <WalletProvider>{children}</WalletProvider>;
}
