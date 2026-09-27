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
    // Generated native app projects (Capacitor) and their build output —
    // not our source, and Xcode/Gradle build artifacts can land here
    // (e.g. ios/DerivedData) producing thousands of unrelated findings.
    "ios/**",
    "android/**",
    "node_modules/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
