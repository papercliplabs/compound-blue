import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
    },
    environment: "jsdom",
    globals: true,
    testTimeout: 120_000,
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    globalSetup: ["./test/global-setup.ts"],
  },
});
