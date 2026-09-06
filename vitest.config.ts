import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
});
