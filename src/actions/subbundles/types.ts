import { BundlerCall } from "@morpho-org/bundler-sdk-viem";

import { SignatureRequest, TransactionRequest } from "@/actions/utils/types";

export interface Subbundle {
  signatureRequirements: SignatureRequest[];
  transactionRequirements: TransactionRequest[];
  bundlerCalls: () => BundlerCall[]; // Encode just in time so we can use signatures
  //   finalSimulationState: MaybeDraft<SimulationState>;
}
