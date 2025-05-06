import { cn } from "@/utils/shadcn";
import { TooltipPopover, TooltipPopoverTrigger, TooltipPopoverContent } from "./ui/tooltipPopover";
import { Core_Prime_Frontier } from "@/generated/gql/whisk/graphql";

type RiskTierProps = {
  tier: Core_Prime_Frontier;
} & React.ComponentProps<"div">;

const RISK_TIER_TOOLTIP_CONTENT: Record<RiskTierProps["tier"], { title: string | null; description: string | null }> = {
  [Core_Prime_Frontier.Core]: {
    title: "Core Lending",
    description:
      "Lending vaults for higher yield, low insolvency risk strategies with a blend of bluechip and small cap assets as collateral.",
  },
  [Core_Prime_Frontier.Prime]: {
    title: null,
    description: null,
  },
  [Core_Prime_Frontier.Frontier]: {
    title: null,
    description: null,
  },
} as const;

function RiskTierPill({ tier }: Pick<RiskTierProps, "tier">) {
  return (
    <span className="inline h-[20px] w-fit rounded-[4px] bg-button-neutral px-1 text-content-secondary label-md">
      {tier.toUpperCase()}
    </span>
  );
}

export default function RiskTier({ tier, className }: RiskTierProps) {
  // TODO: This can be removed once content for the other tiers are added.
  // Update the types as well.
  if (!RISK_TIER_TOOLTIP_CONTENT[tier].title || !RISK_TIER_TOOLTIP_CONTENT[tier].description) {
    return <RiskTierPill tier={tier} />;
  }

  return (
    <TooltipPopover>
      <TooltipPopoverTrigger className={cn("flex items-center gap-2", className)}>
        <RiskTierPill tier={tier} />
      </TooltipPopoverTrigger>
      <TooltipPopoverContent className="flex max-w-[320px] flex-col gap-4">
        <div className="label-md">{RISK_TIER_TOOLTIP_CONTENT[tier].title}</div>
        <div className="text-content-primary/50 paragraph-sm">{RISK_TIER_TOOLTIP_CONTENT[tier].description}</div>
      </TooltipPopoverContent>
    </TooltipPopover>
  );
}
