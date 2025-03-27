import Link from "next/link";
import { Button } from "../ui/button";
import EducationalSummaryTemplate, { EducationalSummaryTemplateProps } from "./EducationalSummaryTemplate";
import { Shield, TrendingDown, TrendingUp } from "lucide-react";

interface BorrowEducationalSummaryProps {
  showLink: boolean;
}

const items: EducationalSummaryTemplateProps["items"] = [
  { name: "Lower Costs", icon: <TrendingDown size={16} className="stroke-accent-ternary" /> },
  { name: "Higher LLTV", icon: <TrendingUp size={16} className="stroke-accent-ternary" /> },
  { name: "Immutable Markets", icon: <Shield size={16} className="stroke-accent-ternary" /> },
];

export default function BorrowEducationalSummary({ showLink }: BorrowEducationalSummaryProps) {
  return (
    <EducationalSummaryTemplate title="Borrow" subtitle="with Compound Blue Markets" items={items}>
      {showLink && (
        <Link href="/borrow">
          <Button className="w-full bg-accent-ternary">Borrow</Button>
        </Link>
      )}
    </EducationalSummaryTemplate>
  );
}
