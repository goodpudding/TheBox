import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler advice, new with eslint-config-next 16. The pages load
    // through a client data provider and set state from effects throughout,
    // so these report as warnings until that pattern is reworked. Everything
    // else still fails the build.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // A leading underscore marks a parameter that is there only so the
      // signature matches the interface it implements.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "apps/workstation-shell/**",
    ".open-next/**",
    ".wrangler/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
