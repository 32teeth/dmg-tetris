import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.js"],
    setupFiles: ["test/setup.js"],
    coverage: {
      provider: "v8",
      include: ["rom/**/*.js"],
      // Boot file only: wires the game to the page, no logic of its own.
      exclude: ["rom/main.js"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
    reporters: ["default", "json"],
    outputFile: { json: "coverage/test-results.json" },
  },
});
