import { createHash } from "crypto";

export function hashArgs(args: unknown): string {
  return createHash("sha256").update(JSON.stringify(args)).digest("hex");
}
