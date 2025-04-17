import { TransactionRequest, SignatureRequest } from "@/components/ActionFlowDialog/ActionFlowProvider";
import { BundlerCall } from "@morpho-org/bundler-sdk-viem";

export interface Subbundle {
  signatureRequirements: SignatureRequest[];
  transactionRequirements: TransactionRequest[];
  bundlerCalls: BundlerCall[];
  //   finalSimulationState: MaybeDraft<SimulationState>;
}
