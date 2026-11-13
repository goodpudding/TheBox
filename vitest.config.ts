import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // next-auth imports "next/server" without the ".js" that Node insists on;
    // letting Vite load it is what lets a test run the real sign-in handlers.
    server: { deps: { inline: ["next-auth"] } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
