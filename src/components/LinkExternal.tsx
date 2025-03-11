import { BLOCK_EXPLORER_BASE_URL, KNOWN_ADDRESSES } from "@/config";
import { formatAddress } from "@/utils/format";
import { cn } from "@/utils/shadcn";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
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
  let displayName: string;
  let displayIcon: string | undefined = undefined;
  if (address && !txHash) {
    path = `/address/${address}`;

    const knownAddress = KNOWN_ADDRESSES[address];
    displayName = knownAddress?.name ?? formatAddress(address);
    displayIcon = knownAddress?.iconSrc;
  } else if (txHash && !address) {
    path = `/tx/${txHash}`;
    displayName = formatAddress(txHash);
  } else {
    throw new Error("Only one of address or txHash must be provided");
  }

  return (
    <LinkExternal href={`${BLOCK_EXPLORER_BASE_URL}${path}`} {...props}>
      {children ?? (
        <>
          {displayName}
          {displayIcon && (
            <Image
              src={displayIcon}
              width={24}
              height={24}
              alt={displayName}
              className="h-6 w-6 shrink-0 rounded-[4px] border"
            />
          )}
        </>
      )}
    </LinkExternal>
  );
}
