import js from "@eslint/js";
import globals from "globals";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".next",
      "node_modules",
      // Deno runtime — type-checked by `npm run check:functions`, not ESLint.
      "supabase/functions",
      // Decommissioned Firebase Functions, kept only as migration reference.
      "functions",
      "scripts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "@next/next": next,
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...next.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Raw <img> is used deliberately in a few spots (see the disable
      // comments there); keep the rule real so those suppressions mean something.
      "jsx-a11y/alt-text": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      "no-empty": "warn",
    },
  }
);
