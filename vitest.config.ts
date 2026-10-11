import { defineConfig } from "vitest/config";

// Tournament logic is plain TypeScript, so tests skip the Cloudflare/React plugins.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
