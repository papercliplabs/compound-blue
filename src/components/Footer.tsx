import Link from "next/link";
import { ModeToggle } from "./ModeToggle";
import LinkExternal from "./LinkExternal";

export default function Footer() {
  return (
    <footer className="flex w-full items-center justify-center justify-self-end font-semibold text-content-secondary">
      <div className="mx-6 flex h-full w-full max-w-screen-xl justify-between border-t pb-10 pt-4 md:items-center md:pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <LinkExternal
            href="https://paperclip.xyz"
            className="hover:underline hover:brightness-100"
            keepReferrer
            hideArrow
          >
            Build by Paperclip Labs
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
