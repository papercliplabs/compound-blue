import { CHAIN_ID, MIN_REMAINING_NATIVE_ASSET_BALANCE_AFTER_WRAPPING } from "@/config";
import { bigIntMax, bigIntMin } from "@/utils/bigint";
import { GENERAL_ADAPTER_1_ADDRESS, SUPPORTED_ADDAPTERS, WRAPPED_NATIVE_ADDRESS } from "@/utils/constants";
import { MathLib, NATIVE_ADDRESS } from "@morpho-org/blue-sdk";
import { BundlerAction } from "@morpho-org/bundler-sdk-viem";
import { MaybeDraft, SimulationState } from "@morpho-org/simulation-sdk";
import { Address, encodeFunctionData, erc20Abi, isAddressEqual, maxUint256 } from "viem";
import { Subbundle } from "./types";

// Allow 0.03% buffer for max transfers on rebasing tokens
// This gives ~1 day grace period for execution if rebasing at 10% APY, which is useful for multisigs.
const REBASEING_MARGIN = BigInt(100030);
const REBASEING_MARGIN_SCALE = BigInt(100000);

interface PrepareInputTransferSubbundleParameters {
  accountAddress: Address;
  tokenAddress: Address;
  amount: bigint; // Max uint256 for entire account balanace
  recipientAddress: Address;
  config: {
    accountSupportsSignatures: boolean;
    tokenIsRebasing: boolean;
    allowWrappingNativeAssets: boolean;
  };
  simulationState: MaybeDraft<SimulationState>;
}

// Input transfer subbundle that supports ERC-20, and also native assets when the ERC-20 is the wrapped native asset
export function prepareInputTransferSubbundle({
  accountAddress,
  tokenAddress,
  amount,
  recipientAddress,
  config: { tokenIsRebasing, allowWrappingNativeAssets },
  simulationState,
}: PrepareInputTransferSubbundleParameters): Subbundle {
  const isMaxTransfer = amount == maxUint256;
  const isWrappedNative = isAddressEqual(tokenAddress, WRAPPED_NATIVE_ADDRESS);

  const accountErc20Holding = simulationState.getHolding(accountAddress, tokenAddress);
  const accountErc20Balance = accountErc20Holding.balance;

  const accountNativeHolding = simulationState.getHolding(accountAddress, NATIVE_ADDRESS);
  const accountNativeBalance = accountNativeHolding.balance;

  let nativeAmountToWrap = 0n;
  const erc20Amount = bigIntMin(amount, accountErc20Balance);
  const usableNativeBalance = bigIntMax(accountNativeBalance - MIN_REMAINING_NATIVE_ASSET_BALANCE_AFTER_WRAPPING, 0n);
  if (isWrappedNative && allowWrappingNativeAssets) {
    nativeAmountToWrap = isMaxTransfer ? usableNativeBalance : bigIntMin(amount - erc20Amount, usableNativeBalance); // Guaranteed to be >= 0
  }

  if (!isMaxTransfer && erc20Amount + nativeAmountToWrap < amount) {
    throw Error("Insufficient wallet balance.");
  }

  let requiredApprovalAmount = erc20Amount;
  if (isMaxTransfer && tokenIsRebasing) {
    requiredApprovalAmount = MathLib.mulDivUp(erc20Amount, REBASEING_MARGIN, REBASEING_MARGIN_SCALE);
  }

  // Mofify the simulation state accordingly
  accountErc20Holding.balance -= erc20Amount;
  accountNativeHolding.balance -= nativeAmountToWrap;

  if (SUPPORTED_ADDAPTERS.includes(recipientAddress)) {
    const recipientTokenHolding = simulationState.getHolding(recipientAddress, tokenAddress);
    recipientTokenHolding.balance += erc20Amount + nativeAmountToWrap;
  }

  // TODO: add support with signatures also, switching based on accountSupportsSignatures
  const inputErc20TransferSubbundle = prepareInputErc20TransferSubbundleWithoutSignatures({
    accountAddress,
    tokenAddress,
    amount: erc20Amount == 0n ? 0n : isMaxTransfer ? maxUint256 : erc20Amount, // Use maxUint256 for rebasing tokens
    recipientAddress,
    requiredApprovalAmount,
    simulationState,
  });

  const sendAndWrapNativeSubbundle = prepareSendAndWrapNativeSubbundle({
    accountAddress,
    amount: nativeAmountToWrap,
    recipientAddress,
  });

  return {
    signatureRequirements: [
      ...inputErc20TransferSubbundle.signatureRequirements,
      ...sendAndWrapNativeSubbundle.signatureRequirements,
    ],
    transactionRequirements: [
      ...inputErc20TransferSubbundle.transactionRequirements,
      ...sendAndWrapNativeSubbundle.transactionRequirements,
    ],
    bundlerCalls: [...inputErc20TransferSubbundle.bundlerCalls, ...sendAndWrapNativeSubbundle.bundlerCalls],
  };
}

interface PrepareInputErc20TransferSubbundleParameters {
  accountAddress: Address;
  tokenAddress: Address;
  amount: bigint; // Max uint256 for entire account balanace
  recipientAddress: Address;
  requiredApprovalAmount: bigint;
  simulationState: MaybeDraft<SimulationState>;
}

function prepareInputErc20TransferSubbundleWithoutSignatures({
  accountAddress,
  tokenAddress,
  amount,
  recipientAddress,
  requiredApprovalAmount,
  simulationState,
}: PrepareInputErc20TransferSubbundleParameters): Subbundle {
  // Nothing to do
  if (amount == 0n) {
    return {
      signatureRequirements: [],
      transactionRequirements: [],
      bundlerCalls: [],
    };
  }

  const accountErc20Holding = simulationState.getHolding(accountAddress, tokenAddress);
  const currentAllowance = accountErc20Holding.erc20Allowances["bundler3.generalAdapter1"];
  const requiresApproval = currentAllowance < requiredApprovalAmount;

  return {
    signatureRequirements: [],
    transactionRequirements: [
      ...(requiresApproval
        ? [
            {
              name: "Approve Token",
              tx: () => ({
                to: tokenAddress,
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: "approve",
                  args: [GENERAL_ADAPTER_1_ADDRESS, requiredApprovalAmount],
                }),
                value: BigInt(0),
              }),
            },
          ]
        : []),
    ],
    bundlerCalls: BundlerAction.erc20TransferFrom(CHAIN_ID, tokenAddress, amount, recipientAddress),
  };
}

interface PrepareSendAndWrapNativeSubbundleParameters {
  accountAddress: Address;
  amount: bigint; // Max uint256 for entire account balance, note it will keep a small amount leftover for gas
  recipientAddress: Address;
}

export function prepareSendAndWrapNativeSubbundle({
  accountAddress,
  amount,
  recipientAddress,
}: PrepareSendAndWrapNativeSubbundleParameters): Subbundle {
  // Nothing to do
  if (amount == 0n) {
    return {
      signatureRequirements: [],
      transactionRequirements: [],
      bundlerCalls: [],
    };
  }

  return {
    signatureRequirements: [],
    transactionRequirements: [],
    bundlerCalls: [
      BundlerAction.nativeTransfer(CHAIN_ID, accountAddress, GENERAL_ADAPTER_1_ADDRESS, amount), // Will send native from user to GA1
      BundlerAction.wrapNative(CHAIN_ID, amount, recipientAddress),
    ].flat(),
  };
}
