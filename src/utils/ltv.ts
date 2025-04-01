import { MAX_BORROW_LTV_MARGIN } from "@/config";

export function computeLtvHealth(ltv: number, lltv?: number): "healthy" | "warning" | "unhealthy" {
  if (!lltv) {
    return "healthy";
  } else if (ltv < lltv - MAX_BORROW_LTV_MARGIN) {
    return "healthy";
  } else if (ltv < lltv) {
    return "warning";
  } else {
    return "unhealthy";
  }
}
