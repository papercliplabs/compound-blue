import { SignatureRequirementFunction } from "@morpho-org/bundler-sdk-viem";
import { Address, Hex, TransactionRequest as ViemTransactionRequest } from "viem";

interface ActionMetadata {
  name: string;
}

export interface SignatureRequest extends ActionMetadata {
  sign: SignatureRequirementFunction;
}

export interface TransactionRequest extends ActionMetadata {
  tx: () => ViemTransactionRequest & {
    to: Address;
    data: Hex;
  };
}

export type SuccessfulAction = {
  status: "success";
  signatureRequests: SignatureRequest[];
  transactionRequests: TransactionRequest[];
};

export type Action =
  | SuccessfulAction
  | {
      status: "error";
      message: string;
    };
