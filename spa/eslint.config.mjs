import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Icons come only from the app icon module (#345), so a later swap of icon
  // library touches one file. Lucide is gone; Phosphor is imported only by
  // components/icons.tsx.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["lucide-react", "lucide-react/*"],
              message: "Import icons from @/components/icons (#345).",
            },
            {
              group: ["@phosphor-icons/*", "@phosphor-icons/*/**"],
              message: "Import icons from @/components/icons (#345).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/icons.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["lucide-react", "lucide-react/*"],
              message: "The app's icons are Phosphor (#345).",
            },
          ],
        },
      ],
    },
  },
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
])

export default eslintConfig
