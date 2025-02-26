"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import Wallet from "./ui/icons/Wallet";

export default function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button
                    variant="secondary"
                    onClick={openConnectModal}
                    className="border border-accent-secondary px-4"
                  >
                    Connect
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button variant="negative" onClick={openChainModal} className="px-4">
                    Wrong network
                  </Button>
                );
              }

              return (
                <Button onClick={openAccountModal} variant="secondary" className="aspect-square border p-0 md:px-4">
                  <span className="hidden md:block">{account.displayName}</span>
                  <Wallet className="block md:hidden" />
                </Button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
