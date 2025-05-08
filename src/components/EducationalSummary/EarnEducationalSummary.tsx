import { Eye, Search, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Button } from "../ui/button";

import EducationalSummaryTemplate, { EducationalSummaryTemplateProps } from "./EducationalSummaryTemplate";

interface EarnEducationalSummaryProps {
  showLink: boolean;
}

const items: EducationalSummaryTemplateProps["items"] = [
  { name: "Curated Risk", icon: <Search size={16} className="stroke-accent-secondary" /> },
  { name: "Better Yield", icon: <TrendingUp size={16} className="stroke-accent-secondary" /> },
  { name: "Noncustodial", icon: <Eye size={16} className="stroke-accent-secondary" /> },
];

export default function EarnEducationalSummary({ showLink }: EarnEducationalSummaryProps) {
  return (
    <EducationalSummaryTemplate title="Earn" subtitle="with Compound Blue Vaults" items={items}>
      {showLink && (
        <Link href="/">
          <Button className="w-full">Earn</Button>
        </Link>
      )}
    </EducationalSummaryTemplate>
  );
}
