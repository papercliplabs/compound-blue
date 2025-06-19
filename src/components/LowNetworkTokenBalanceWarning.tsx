import { Card } from "./ui/card";
import Warning from "./ui/icons/Warning";

export function LowNetworkTokenBalanceWarning() {
  return (
    <Card className="flex gap-3 bg-background-warning p-4">
      <Warning className="mt-1 size-6 shrink-0" />
      <p>
        This transaction will use most of your network tokens, which may leave you with insufficient balance to cover
        future transaction fees.
      </p>
    </Card>
  );
}
