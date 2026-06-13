import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
      }],
      "eqeqeq": "error",
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "prefer-const": "error",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["src/__tests__/**/*.js", "src/__tests__/**/*.ts", "**/*.test.js", "**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
);
