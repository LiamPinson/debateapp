import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{js,ts}"],
    setupFiles: ["tests/setup.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
