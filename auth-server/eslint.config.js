import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Same rules as api/eslint.config.js, without type-aware linting: the tests
// sit outside tsconfig.json (which only includes src), and `npm run build`
// is already the type check.
export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ["dist", "node_modules", "coverage"],
    },
    {
        files: ["**/*.ts"],
        rules: {
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    }
);
