import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importPlugin from "eslint-plugin-import";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      // Rule 11: Features must not import from other features.
      // Rule 14: engine/ and services/ must not import from features/.
      // Rule 15: ui/ must not import from features/.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/features/animator",
              from: "./src/features/jelly-sprite",
              message: "animator must not import from jelly-sprite (Rule 11)",
            },
            {
              target: "./src/features/jelly-sprite",
              from: "./src/features/animator",
              message: "jelly-sprite must not import from animator (Rule 11)",
            },
            {
              target: "./src/engine",
              from: "./src/features",
              message: "engine/ must be pure — no feature imports (Rule 14)",
            },
            {
              target: "./src/services",
              from: "./src/features",
              message:
                "services/ must be I/O only — no feature imports (Rule 15)",
            },
            {
              target: "./src/ui",
              from: "./src/features",
              message: "ui/ must not import from features/ (Rule 15)",
            },
          ],
        },
      ],
    },
  },
]);
