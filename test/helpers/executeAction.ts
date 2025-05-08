import { AnvilTestClient } from "@morpho-org/test";
import { Hex, Log } from "viem";
import { getTransactionReceipt, sendTransaction } from "viem/actions";
import { expect } from "vitest";

import { Action } from "@/actions/utils/types";

export async function executeAction(client: AnvilTestClient, action: Action): Promise<Log[]> {
  if (action.status == "error") {
    console.log("DEBUG", action);
  }
  expect(action.status).toBe("success");

  let logs: Log[] = [];
  if (action.status === "success") {
    try {
      for (const step of action.signatureRequests) {
        await step.sign(client);
      }
    } catch {
      throw Error("signature failed");
    }

    // Remove try-catch to get full trace for debugging
    for (const step of action.transactionRequests) {
      const tx = step.tx();
      let hash: Hex;
      try {
        // This will also throw sometimes, not sure why, but likely due to debug tracing.. (execution reverted)
        hash = await sendTransaction(client, { ...tx, account: client.account.address });
      } catch {
        // console.log("Send threw...", e);
        throw Error("action-tx-reverted");
      }
      const receipt = await getTransactionReceipt(client, { hash });
      if (receipt.status == "reverted") {
        throw Error("action-tx-reverted");
      }

      logs = [...logs, ...receipt.logs];
    }
  }

  return logs;
}
