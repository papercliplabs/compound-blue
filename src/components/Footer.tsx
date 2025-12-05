import Link from "next/link";

import LinkExternal from "./LinkExternal";
import { ModeToggle } from "./ModeToggle";
import PoweredByMorpho from "./ui/icons/PoweredByMorpho";

export default function Footer() {
  return (
    <footer className="flex w-full items-center justify-center justify-self-end text-content-secondary label-sm">
      <div className="mx-6 flex h-full w-full max-w-screen-xl flex-col gap-5 border-t pb-20 pt-6 lg:pb-4 lg:pt-4">
        <div className="flex w-full justify-between">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-6">
            <LinkExternal href="https://morpho.org/" keepReferrer hideArrow>
              <PoweredByMorpho />
            </LinkExternal>
            <LinkExternal
              href="https://paperclip.xyz"
              className="hover:underline hover:brightness-100"
              keepReferrer
              hideArrow
            >
              Built by Paperclip Labs
            </LinkExternal>
            <LinkExternal
              href="https://github.com/Compound-Foundation/compound-blue"
              className="hover:underline hover:brightness-100"
              keepReferrer
              hideArrow
            >
              Github
            </LinkExternal>
            <LinkExternal
              href="https://docs.morpho.org"
              className="hover:underline hover:brightness-100"
              keepReferrer
              hideArrow
            >
              Docs
            </LinkExternal>
            <LinkExternal
              href="https://compound.finance/discord"
              className="hover:underline hover:brightness-100"
              keepReferrer
              hideArrow
            >
              Support
            </LinkExternal>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
          </div>
          <ModeToggle />
        </div>
        <div className="flex max-w-[680px] flex-col gap-4 text-content-ternary paragraph-sm">
          <span>
            A joint project between Compound, Morpho, Polygon, and Gauntlet.{" "}
            <LinkExternal
              href="https://www.comp.xyz/t/compound-morpho-polygon-collaboration/6306"
              className="inline underline"
              hideArrow
            >
              Learn more
            </LinkExternal>
          </span>
          <div>
            Compound Blue is a community-built interface for the Compound DAO. This site is part of the Compound
            ecosystem but operates independently from{" "}
            <LinkExternal href="https://compound.finance" className="inline underline" hideArrow>
              compound.finance
            </LinkExternal>
            . Always verify URLs before connecting your wallet.
          </div>
        </div>
      </div>
    </footer>
  );
}
