import { expect } from "vitest";

declare module "vitest" {
  interface Assertion {
    toBeWithinRange<T extends bigint | number>(floor: T, ceiling: T): void;
  }
  interface AsymmetricMatchersContaining {
    toBeWithinRange<T extends bigint | number>(floor: T, ceiling: T): void;
  }
}

expect.extend({
  toBeWithinRange<T extends bigint | number>(received: T, floor: T, ceiling: T) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range [${floor}, ${ceiling}]`
          : `expected ${received} to be within range [${floor}, ${ceiling}]`,
    };
  },
});

export {};
