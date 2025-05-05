import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import parserTs from "@typescript-eslint/parser";
import pluginTs from "@typescript-eslint/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        project: "./tsconfig.json", 
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": pluginTs,
    },
    rules: {
      // Promise must be awaited, or explicitly marked as void for fire and forget
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
];

export default eslintConfig;
