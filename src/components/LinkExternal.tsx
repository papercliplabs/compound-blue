import { BLOCK_EXPLORER_BASE_URL } from "@/config";
import { formatAddress } from "@/utils/format";
import { cn } from "@/utils/shadcn";
import { ArrowUpRight } from "lucide-react";
import { AnchorHTMLAttributes } from "react";
import { Address } from "viem";

interface LinkExternalProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  keepReferrer?: boolean; // Allow sending our site as referrer
  noFollow?: boolean; // Prevent SEO endorsement
  hideArrow?: boolean;
}

export default function LinkExternal({
  href,
  keepReferrer,
  noFollow,
  children,
  hideArrow,
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
      {!hideArrow && <ArrowUpRight className="aspect-square w-[1.1em] stroke-content-secondary" />}
    </a>
  );
}

export function LinkExternalBlockExplorer({
  address,
  txHash,
  children,
  ...props
}: { address?: Address; txHash?: Address } & LinkExternalProps) {
  let path;
  if (address && !txHash) {
    path = `/address/${address}`;
  } else if (txHash && !address) {
    path = `/tx/${txHash}`;
  } else {
    throw new Error("Only one of address or txHash must be provided");
  }

  return (
    <LinkExternal href={`${BLOCK_EXPLORER_BASE_URL}${path}`} {...props}>
      {children ?? formatAddress((address ?? txHash)!)}
    </LinkExternal>
  );
}
