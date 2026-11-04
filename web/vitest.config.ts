import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "node",
    // Fewer parallel workers: starting several browser-like (jsdom) workers at
    // once times out on slower laptops.
    maxWorkers: 2,
    // Threads start faster than forked processes on Windows.
    pool: "threads",
  },
});
