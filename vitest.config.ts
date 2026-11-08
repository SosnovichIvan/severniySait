import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["tests/server*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          setupFiles: ["tests/setup.ts"],
          include: ["tests/web*.test.tsx"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "server/**/*.ts", "contracts/**/*.ts"],
      reporter: ["text", "json", "json-summary", "html"],
      thresholds: {
        "src/**": { lines: 90, branches: 90 },
        "server/**": { lines: 90, branches: 90 },
        "contracts/**": { lines: 90, branches: 90 },
      },
    },
  },
});
