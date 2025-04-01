import { PrepareActionReturnType } from "@/actions/helpers";
import { AnvilTestClient } from "@morpho-org/test";
import { expect } from "vitest";
import { sendTransaction } from "viem/actions";

export async function executeAction(client: AnvilTestClient, action: PrepareActionReturnType) {
  expect(action.status).toBe("success");

  if (action.status === "success") {
    try {
      for (const step of action.signatureRequests) {
        await step.sign(client);
      }
    } catch {
      throw Error("signature failed");
    }

    // Remove try-catch to get full trace for debugging
    try {
      for (const step of action.transactionRequests) {
        const tx = step.tx();
        await sendTransaction(client, { ...tx, account: client.account.address });
      }
    } catch {
      throw Error("tx failed");
    }
  }
}
