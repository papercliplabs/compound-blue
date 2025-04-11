import { expect } from "vitest";
import { Address, erc20Abi, Log, parseEventLogs } from "viem";
import { permit2Abi } from "@morpho-org/blue-sdk-viem";
import { GENERAL_ADAPTER_1_ADDRESS, PERMIT2_ADDRESS } from "@/utils/constants";

// Parses transaction logs to validate:
//   * Any account approvals are for GA1 or permit2 only
//   * Any account permits are for GA1 only
export async function expectOnlyAllowedApprovals(logs: Log[], accountAddress: Address) {
  const erc20Events = await parseEventLogs({
    logs: logs,
    abi: erc20Abi,
  });

  const permit2Events = await parseEventLogs({
    logs: logs,
    abi: permit2Abi,
  });

  const erc20Approvals = erc20Events
    .filter(
      (event): event is typeof event & { eventName: "Approval" } =>
        event.eventName === "Approval" && event.args.owner === accountAddress
    )
    .map((event) => ({
      asset: event.address,
      spender: event.args.spender,
      amount: event.args.value,
    }));

  const permits = permit2Events
    .filter(
      (event): event is typeof event & { eventName: "Permit" } =>
        event.eventName === "Permit" && event.args.owner === accountAddress
    )
    .map((event) => ({
      asset: event.args.token,
      spender: event.args.spender,
      amount: event.args.amount,
    }));

  // Only ever allowed to approve GA1 or permit2
  for (const erc20Approval of erc20Approvals) {
    expect([GENERAL_ADAPTER_1_ADDRESS, PERMIT2_ADDRESS]).includes(erc20Approval.spender);
  }

  // Only ever allowed to permit GA1
  for (const permit of permits) {
    expect(permit.spender).toBe(GENERAL_ADAPTER_1_ADDRESS);
  }

  // TODO: also verify that the approvals / permits were fully used up (with rebasing margin allowed to be left over)
}
