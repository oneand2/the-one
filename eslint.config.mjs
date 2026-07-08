import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "android/**",
    "public/**",
    "next/**",
    ".claude/**",
    "the-one@*/**",
    "test-*.js",
    "test-*.html",
    "*.md",
    "*.sql",
  ]),
  {
    rules: {
      // The current app has legacy data-shaping and cached-state code that
      // predates the stricter React 19 / Next 16 lint defaults. Keep these
      // visible during cleanup without blocking feature work.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
