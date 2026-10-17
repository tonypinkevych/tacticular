import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  base: "./",
  plugins: [solid()],
  test: { globals: true, environment: "node", include: ["test/**/*.test.ts"] },
})
