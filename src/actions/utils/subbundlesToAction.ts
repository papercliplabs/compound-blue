import { Subbundle } from "../subbundles/types";

import { createBundle } from "./bundlerActions";
import { SuccessfulAction } from "./types";

// Encode subbundles into an action in the order they are provided
export function subbundlesToAction(subbundles: Subbundle[], executeBundleName: string): SuccessfulAction {
  return {
    status: "success",
    signatureRequests: subbundles.flatMap((subbundle) => subbundle.signatureRequirements),
    transactionRequests: [
      ...subbundles.flatMap((subbundle) => subbundle.transactionRequirements),
      {
        tx: () => {
          // Just in time so we can use signatures
          const bundlerCalls = subbundles.flatMap((subbundle) =>
            typeof subbundle.bundlerCalls === "function" ? subbundle.bundlerCalls() : subbundle.bundlerCalls
          );
          return createBundle(bundlerCalls);
        },
        name: executeBundleName,
      },
    ],
  };
}
