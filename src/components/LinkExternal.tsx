import { BLOCK_EXPLORER_BASE_URL } from "@/config";
import { formatAddress } from "@/utils/format";
import { cn } from "@/utils/shadcn";
import { ArrowUpRight } from "lucide-react";
import { AnchorHTMLAttributes } from "react";
import { Address } from "viem";

interface LinkExternalProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  keepReferrer?: boolean; // Allow sending our site as referrer
  noFollow?: boolean; // Prevent SEO endorsement
  showArrow?: boolean;
}

export default function LinkExternal({
  href,
  keepReferrer,
  noFollow,
  children,
  className,
  ...props
}: LinkExternalProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel={`noopener ${keepReferrer ? "" : "noreferrer"} ${noFollow ? "nofollow" : ""}`}
      className={cn("flex items-center gap-2 transition-all hover:brightness-75", className)}
      {...props}
    >
      {children}
      <ArrowUpRight className="aspect-square w-[1.1em] stroke-content-secondary" />
    </a>
  );
}

export function LinkExternalBlockExplorer({ address, children, ...props }: { address: Address } & LinkExternalProps) {
  return (
    <LinkExternal href={`${BLOCK_EXPLORER_BASE_URL}/address/${address}`} {...props}>
      {children ?? formatAddress(address)}
    </LinkExternal>
  );
}
