import { BundlerCall } from "@morpho-org/bundler-sdk-viem";

import { SignatureRequest, TransactionRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";

export interface Subbundle {
  signatureRequirements: SignatureRequest[];
  transactionRequirements: TransactionRequest[];
  bundlerCalls: BundlerCall[];
  //   finalSimulationState: MaybeDraft<SimulationState>;
}
