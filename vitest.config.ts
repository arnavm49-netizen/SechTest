import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      include: [
        "src/lib/scoring/aggregation.ts",
        "src/lib/scoring/classical.ts",
        "src/lib/scoring/config.ts",
        "src/lib/scoring/irt.ts",
        "src/lib/scoring/math.ts",
        "src/lib/scoring/quality.ts",
        "src/lib/scoring/utils.ts",
      ],
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        branches: 80,
        functions: 98,
        lines: 100,
        statements: 99,
      },
    },
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
  },
});
