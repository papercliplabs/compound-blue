import fc from "fast-check";
import { describe, it } from "vitest";

import { computePerSwapMaxSlippageToleranceV2 } from "@/actions/subbundles/aaveV3PortfolioWindDownSubbundle";

describe("computePerSwapMaxSlippageToleranceV2", () => {
  it("property: minimum output respects user-specified S_T", { timeout: 100_000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }), // S_T: overall slippage (0.1% to 50%)
        fc.bigInt({ min: 0n, max: 1_000_000n }), // C_D
        fc.bigInt({ min: 0n, max: 1_000_000n }), // L_D
        fc.bigInt({ min: 1n, max: 1_000_000n }), // F_CS
        fc.bigInt({ min: 0n, max: 1_000_000n }), // F_LS
        (rawS_T, C_D, L_D, F_CS, F_LS) => {
          const initialPortfolioValue = F_CS + C_D - F_LS - L_D;
          fc.pre(initialPortfolioValue > 0n);

          const decimals = 0;
          const performingOutputSwap = true;
          const S_T = rawS_T / 1000; // Convert to percentage

          const S = computePerSwapMaxSlippageToleranceV2(S_T, C_D, L_D, F_CS, F_LS, decimals, performingOutputSwap);

          const maxF_L = Number(F_LS) * (1 + S) + Number(L_D);
          const minF_C = Number(F_CS) / (1 + S) + Number(C_D);
          const minF_R = minF_C - maxF_L;
          const minO = minF_R / (1 + S);

          const expectedMinO = Number(initialPortfolioValue) / (1 + S_T);

          // Allow for small floating point errors
          return minO - expectedMinO >= -0.0001;
        }
      ),
      { numRuns: 100_000, verbose: true }
    );
  });
});
