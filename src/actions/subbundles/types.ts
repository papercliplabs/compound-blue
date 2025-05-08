import { TransactionRequest, SignatureRequest } from "@/actions/utils/types";
import { BundlerCall } from "@morpho-org/bundler-sdk-viem";

export interface Subbundle {
  signatureRequirements: SignatureRequest[];
  transactionRequirements: TransactionRequest[];
  bundlerCalls: () => BundlerCall[]; // Encode just in time so we can use signatures
  //   finalSimulationState: MaybeDraft<SimulationState>;
}
