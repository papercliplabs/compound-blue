import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import "dotenv/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    retry: process.env.CI ? 3 : 0,
    coverage: {
      reporter: ["text", "json", "html"],
    },
    environment: "jsdom",
    globals: true,
    testTimeout: 120_000,
    include: ["./test/unit/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    sequence: {
      // Seems there is some state leakage between anvil forks which causes undeterminstic failures
      concurrent: false, // Forces sequential execution within a single test file
    },
  },
});
