import Link from "next/link";
import { ModeToggle } from "./ModeToggle";
import LinkExternal from "./LinkExternal";
import PoweredByMorpho from "./ui/icons/PoweredByMorpho";

export default function Footer() {
  return (
    <footer className="label-sm flex w-full items-center justify-center justify-self-end text-content-secondary">
      <div className="mx-6 flex h-full w-full max-w-screen-xl justify-between border-t pb-20 pt-6 md:items-center md:pb-4 md:pt-4">
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
            href="https://github.com/papercliplabs/compound-blue"
            className="hover:underline hover:brightness-100"
            keepReferrer
            hideArrow
          >
            Github
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
    </footer>
  );
}
