import { MathLib } from "@morpho-org/blue-sdk";
import { permit2Abi } from "@morpho-org/blue-sdk-viem";
import { AnvilTestClient } from "@morpho-org/test";
import { Address, Log, erc20Abi, parseEventLogs } from "viem";
import { readContract } from "viem/actions";
import { expect } from "vitest";

import { GENERAL_ADAPTER_1_ADDRESS, PERMIT2_ADDRESS } from "@/utils/constants";

const REBASEING_MARGIN = BigInt(100030);
const REBASEING_MARGIN_SCALE = BigInt(100000);

// Parses transaction logs to validate:
//   * Any account approvals are for GA1 or permit2 only
//   * Any account permits are for GA1 only
export async function expectOnlyAllowedApprovals(client: AnvilTestClient, logs: Log[], accountAddress: Address) {
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

  // Verify that the entire approval is used up (or at least up to the rebasing margin)
  for (const erc20Approval of erc20Approvals) {
    const erc20Allowance = await readContract(client, {
      address: erc20Approval.asset,
      abi: erc20Abi,
      functionName: "allowance",
      args: [accountAddress, erc20Approval.spender],
    });
    expect(erc20Allowance).toBeLessThanOrEqual(
      MathLib.mulDivUp(erc20Approval.amount, REBASEING_MARGIN, REBASEING_MARGIN_SCALE)
    );
  }

  // Verify that the entire permit is used up (or at least up to the rebasing margin)
  for (const permit of permits) {
    const permitAllowance = await readContract(client, {
      address: PERMIT2_ADDRESS,
      abi: permit2Abi,
      functionName: "allowance",
      args: [accountAddress, permit.asset, permit.spender],
    });
    expect(permitAllowance[0]).toBeLessThanOrEqual(
      MathLib.mulDivUp(permit.amount, REBASEING_MARGIN, REBASEING_MARGIN_SCALE)
    );
  }
}
