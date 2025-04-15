import { PrepareActionReturnType } from "@/actions/helpers";
import { AnvilTestClient } from "@morpho-org/test";
import { expect } from "vitest";
import { getTransactionReceipt, sendTransaction } from "viem/actions";
import { Log } from "viem";

export async function executeAction(client: AnvilTestClient, action: PrepareActionReturnType): Promise<Log[]> {
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
    // try {
    for (const step of action.transactionRequests) {
      const tx = step.tx();
      const hash = await sendTransaction(client, { ...tx, account: client.account.address });
      const receipt = await getTransactionReceipt(client, { hash });
      if (receipt.status == "reverted") {
        throw Error("action-tx-reverted");
      }

      logs = [...logs, ...receipt.logs];
    }
    // } catch (e) {
    //   throw Error("execution error", { cause: e });
    // }
  }

  return logs;
}
