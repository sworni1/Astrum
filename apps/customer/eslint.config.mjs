import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // ESLint 10 resolves a rule plugin per config object, so the plugin has to be
    // registered here as well as in eslint-config-next.
    plugins: { "react-hooks": reactHooks },
    rules: {
      // react-hooks 7 (React Compiler rules) flags the vendored shadcn carousel and
      // four prop-to-state sync effects. Kept as a warning until those components
      // are refactored; it is a performance hint, not a correctness bug.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    linterOptions: { noInlineConfig: true },
    rules: {
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      "no-console": ["error", { allow: ["error"] }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../**"],
              message: "Use the @/ alias outside this folder.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: { "max-lines": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docker/**",
  ]),
]);

export default eslintConfig;
