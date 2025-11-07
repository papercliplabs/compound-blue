import { AnvilTestClient } from "@morpho-org/test";
import { Address, isAddressEqual, maxUint256, parseEther, parseUnits } from "viem";
import { getBalance } from "viem/actions";
import { describe, expect } from "vitest";

import { getSimulationState } from "@/actions/data/rpc/getSimulationState";
import { inputTransferSubbundle } from "@/actions/subbundles/inputTransferSubbundle";
import { createBundle } from "@/actions/utils/bundlerActions";
import { Action } from "@/actions/utils/types";
import { bigIntMax, bigIntMin } from "@/utils/bigint";
import { WRAPPED_NATIVE_ADDRESS } from "@/utils/constants";

import { test } from "../../../config";
import { RANDOM_ADDRESS, USDC_ADDRESS, USDC_VAULT_ADDRESS } from "../../../helpers/constants";
import { getErc20BalanceOf } from "../../../helpers/erc20";
import { executeAction } from "../../../helpers/executeAction";
import { expectOnlyAllowedApprovals } from "../../../helpers/logs";

interface RunInputTransferSubbundleTestParameters {
  client: AnvilTestClient;

  tokenAddress: Address;
  amount: bigint; // Max uint256 for entire account balance
  recipientAddress: Address;
  config: {
    accountSupportsSignatures: boolean;
    tokenIsRebasing: boolean;
    allowWrappingNativeAssets: boolean;
  };

  initialWalletBalance: bigint;
  initialNativeBalance?: bigint;
  beforeExecutionCb?: (client: AnvilTestClient) => Promise<void>;
}

async function runInputTransferSubbundleTest({
  client,
  tokenAddress,
  amount,
  recipientAddress,
  config,
  initialWalletBalance,
  initialNativeBalance = parseEther("1"),
  beforeExecutionCb,
}: RunInputTransferSubbundleTestParameters) {
  // Arrange
  if (initialWalletBalance > 0n) {
    await client.deal({
      erc20: tokenAddress,
      amount: initialWalletBalance,
    });
  }
  await client.setBalance({
    address: client.account.address,
    value: initialNativeBalance,
  });
  const isWrappedNative = isAddressEqual(tokenAddress, WRAPPED_NATIVE_ADDRESS);
  const recipientInitialBalance = await getErc20BalanceOf(client, tokenAddress, recipientAddress);

  // Act
  const simulationState = await getSimulationState({
    publicClient: client,
    accountAddress: client.account.address,
    actionType: "vault",
    vaultAddress: USDC_VAULT_ADDRESS, // Not relevent
    additionalTokenAddresses: [tokenAddress],
  });
  const subbundle = inputTransferSubbundle({
    accountAddress: client.account.address,
    tokenAddress,
    amount,
    recipientAddress,
    config,
    simulationState,
  });
  const bundle = createBundle(subbundle.bundlerCalls());
  const action: Action = {
    status: "success",
    signatureRequests: subbundle.signatureRequirements,
    transactionRequests: [...subbundle.transactionRequirements, { name: "Bundle", tx: () => bundle }],
  };
  await beforeExecutionCb?.(client);
  const logs = await executeAction(client, action);

  // Assert
  await expectOnlyAllowedApprovals(client, logs, client.account.address); // Make sure doesn't approve or permit anything unexpected

  const recipientFinalBalance = await getErc20BalanceOf(client, tokenAddress, recipientAddress);
  const walletFinalBalance = await getErc20BalanceOf(client, tokenAddress, client.account.address);
  const walletFinalNativeBalance = await getBalance(client, { address: client.account.address });

  // Assert based on exact amount transferred (no maxUint256 support)
  if (isWrappedNative && config.allowWrappingNativeAssets) {
    const erc20AmountUsed = bigIntMin(amount, initialWalletBalance);
    const wrappedNativeAmountUsed = bigIntMax(amount - erc20AmountUsed, 0n);

    expect(recipientFinalBalance).toBe(recipientInitialBalance + amount);
    expect(walletFinalBalance).toBe(initialWalletBalance - erc20AmountUsed);
    expect(walletFinalNativeBalance).toBe(initialNativeBalance - wrappedNativeAmountUsed);
  } else {
    expect(recipientFinalBalance).toBe(recipientInitialBalance + amount);
    // walletFinalBalance could be > (initialWalletBalance - amount) if rebasing added tokens
    // but we only transfer the exact amount requested
    expect(walletFinalBalance).toBeGreaterThanOrEqual(initialWalletBalance - amount);
  }
}

// Transfer with signautres not currently implemented for the input transfer subbundle, but they should continue to pass when it is
const successTestCases: ({ name: string } & Omit<RunInputTransferSubbundleTestParameters, "client">)[] = [
  // Partial transfers non wrapped native
  {
    name: "partial transfer non wrapped native - no signatures, no rebasing, no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("100", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },
  {
    name: "partial transfer non wrapped native - no signatures, rebasing, wrapping (should do nothing different)",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("100", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },
  {
    name: "partial transfer non wrapped native - signatures, no rebasing, no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("100", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },
  {
    name: "partial transfer non wrapped native - signatures, rebasing, wrapping (should do nothing different)",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("100", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },

  // Full transfers non wrapped native
  {
    name: "full transfer non wrapped native - no signatures, no rebasing, no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },
  {
    name: "full transfer non wrapped native - no signatures, rebasing (none added), no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },
  {
    name: "full transfer non wrapped native - no signatures, rebasing (added), no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
    beforeExecutionCb: async (client) => {
      // Simulate rebasing, but below the margin
      await client.deal({ erc20: USDC_ADDRESS, amount: parseUnits("1000.2", 6) });
    },
  },
  {
    name: "full transfer non wrapped native - no signatures, rebasing (added), wrapping (should do nothing different)",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
    beforeExecutionCb: async (client) => {
      // Simulate rebasing, but below the margin
      await client.deal({ erc20: USDC_ADDRESS, amount: parseUnits("1000.2", 6) });
    },
  },
  {
    name: "full transfer non wrapped native - signatures, no rebasing, no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },
  {
    name: "full transfer non wrapped native - signatures, rebasing (none added), no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
  },
  {
    name: "full transfer non wrapped native - signatures, rebasing (added), no wrapping",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
    beforeExecutionCb: async (client) => {
      // Simulate rebasing, but below the margin
      await client.deal({ erc20: USDC_ADDRESS, amount: parseUnits("1000.2", 6) });
    },
  },
  {
    name: "full transfer non wrapped native - signatures, rebasing (added), wrapping (should do nothing different)",
    tokenAddress: USDC_ADDRESS,
    amount: parseUnits("1000", 6),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseUnits("1000", 6),
    beforeExecutionCb: async (client) => {
      // Simulate rebasing, but below the margin
      await client.deal({ erc20: USDC_ADDRESS, amount: parseUnits("1000.2", 6) });
    },
  },

  // Partial transfer, wrapped native
  {
    name: "partial transfer wrapped native - no signatures, no rebasing, no wrapping",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("0.8"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "partial transfer wrapped native - no signatures, no rebasing, wrapping (no native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("0.8"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "partial transfer wrapped native - no signatures, no rebasing, wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1.4"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "partial transfer wrapped native - no signatures, rebasing (should do nothing different), wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1.4"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "partial transfer wrapped native - signatures, no rebasing, no wrapping",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("0.8"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "partial transfer wrapped native - signatures, no rebasing, wrapping (no native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("0.8"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "partial transfer wrapped native - signatures, no rebasing, wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1.4"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "partial transfer wrapped native - signatures, rebasing (should do nothing different), wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1.4"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },

  // Full transfer, wrapped native
  {
    name: "full transfer wrapped native - no signatures, no rebasing, no wrapping",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "full transfer wrapped native - no signatures, no rebasing, wrapping (no native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "full transfer wrapped native - no signatures, no rebasing, wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("2.9"), // 1 (wrapped) + 1.9 (from native, leaving 0.1 buffer)
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "full transfer wrapped native - no signatures, rebasing (should do nothing different), wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("2.9"), // 1 (wrapped) + 1.9 (from native, leaving 0.1 buffer)
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: false,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "full transfer wrapped native - signatures, no rebasing, no wrapping",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1"), // Gas buffer
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: false,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "full transfer wrapped native - signatures, no rebasing, wrapping (no native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("1"),
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "full transfer wrapped native - signatures, no rebasing, wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("2.9"), // 1 (wrapped) + 1.9 (from native, leaving 0.1 buffer)
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: false,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
  {
    name: "full transfer wrapped native - signatures, rebasing (should do nothing different), wrapping (native consumption)",
    tokenAddress: WRAPPED_NATIVE_ADDRESS,
    amount: parseEther("2.9"), // 1 (wrapped) + 1.9 (from native, leaving 0.1 buffer)
    recipientAddress: RANDOM_ADDRESS,
    config: {
      accountSupportsSignatures: true,
      tokenIsRebasing: true,
      allowWrappingNativeAssets: true,
    },
    initialWalletBalance: parseEther("1"),
    initialNativeBalance: parseEther("2"),
  },
];

describe("inputTransferSubbundle", () => {
  describe("happy path", () => {
    for (const testCase of successTestCases) {
      test(testCase.name, ({ client }) => runInputTransferSubbundleTest({ ...testCase, client }));
    }
  });

  describe("sad path", () => {
    test("partial transfer non wrapped native insufficient balance", async ({ client }) => {
      await expect(
        runInputTransferSubbundleTest({
          client,
          tokenAddress: USDC_ADDRESS,
          amount: parseUnits("1000", 6),
          recipientAddress: RANDOM_ADDRESS,
          config: {
            accountSupportsSignatures: false,
            tokenIsRebasing: false,
            allowWrappingNativeAssets: false,
          },
          initialWalletBalance: parseUnits("500", 6),
        })
      ).rejects.toThrow("Insufficient wallet balance.");
    });

    test("partial transfer wrapped native no wrapping insufficient balance", async ({ client }) => {
      await expect(
        runInputTransferSubbundleTest({
          client,
          tokenAddress: WRAPPED_NATIVE_ADDRESS,
          amount: parseEther("10"),
          recipientAddress: RANDOM_ADDRESS,
          config: {
            accountSupportsSignatures: false,
            tokenIsRebasing: false,
            allowWrappingNativeAssets: false,
          },
          initialWalletBalance: parseEther("5"),
          initialNativeBalance: parseEther("10"),
        })
      ).rejects.toThrow("Insufficient wallet balance.");
    });

    test("partial transfer wrapped native with wrapping insufficient balance", async ({ client }) => {
      await expect(
        runInputTransferSubbundleTest({
          client,
          tokenAddress: WRAPPED_NATIVE_ADDRESS,
          amount: parseEther("100"),
          recipientAddress: RANDOM_ADDRESS,
          config: {
            accountSupportsSignatures: false,
            tokenIsRebasing: false,
            allowWrappingNativeAssets: true,
          },
          initialWalletBalance: parseEther("5"),
          initialNativeBalance: parseEther("10"),
        })
      ).rejects.toThrow("Insufficient wallet balance.");
    });

    test("fails when amount is max uint256", async ({ client }) => {
      await expect(
        runInputTransferSubbundleTest({
          client,
          tokenAddress: USDC_ADDRESS,
          amount: maxUint256,
          recipientAddress: RANDOM_ADDRESS,
          config: {
            accountSupportsSignatures: false,
            tokenIsRebasing: false,
            allowWrappingNativeAssets: false,
          },
          initialWalletBalance: parseUnits("1000", 6),
        })
      ).rejects.toThrow("Max uint256 transfer is not supported");
    });
  });
});
