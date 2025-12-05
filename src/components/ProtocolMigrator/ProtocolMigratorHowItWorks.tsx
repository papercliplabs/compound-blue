"use client";
import Image from "next/image";

import { useTheme } from "@/hooks/useTheme";

import LinkExternal from "../LinkExternal";
import { DialogDrawer, DialogDrawerContent, DialogDrawerTitle, DialogDrawerTrigger } from "../ui/dialogDrawer";

export default function ProtocolMigratorHowItWorks() {
  const { theme } = useTheme();

  return (
    <DialogDrawer>
      <DialogDrawerTrigger className="text-accent-primary underline transition-all paragraph-md hover:brightness-90">
        How it works
      </DialogDrawerTrigger>
      <DialogDrawerContent>
        <DialogDrawerTitle>How it works</DialogDrawerTitle>
        <p>The Migrator lets you move your entire portfolio from Aave v3 over to Compound Blue in one Transaction.</p>
        <div className="h-[1px] w-full bg-border-primary" />
        <p className="text-content-secondary">
          <span className="text-content-primary">For example:</span> Migrate all your assets from Aave v3 to the
          compUSDC vault.
        </p>
        <Image
          src={
            theme == "light" ? "/protocol-migrator-how-it-works-light.png" : "/protocol-migrator-how-it-works-dark.png"
          }
          width={340}
          height={288}
          alt="How it works"
        />
        <LinkExternal
          href="https://github.com/Compound-Foundation/compound-blue/blob/main/src/actions/docs/aave-wind-down/technical-explination.md"
          className="flex w-full items-center justify-center text-accent-primary"
        >
          View the technical details
        </LinkExternal>
      </DialogDrawerContent>
    </DialogDrawer>
  );
}
