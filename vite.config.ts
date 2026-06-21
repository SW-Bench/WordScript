/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  // Tauri expects a fixed origin in dev; don't expose to network
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't trigger rebuilds when Rust files change
      ignored: ["**/src-tauri/**"]
    }
  },
  // Required for Tauri to load assets with relative paths
  base: "./",
  build: {
    // Tauri targets ES2021 minimum on all supported platforms
    target: ["es2021", "chrome105", "safari15"],
    // Don't minify for better debuggability (Tauri bundles the whole thing anyway)
    minify: !process.env.TAURI_DEBUG,
    // Produce sourcemaps in dev mode for easier debugging
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: "dist"
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    // Only run WordScript's own tests: skip nested worktrees and the
    // third-party donor/vendor reference repos vendored into the tree.
    exclude: [
      ...configDefaults.exclude,
      "**/.kilo/**",
      "donors/**",
      "vendor/**",
    ]
  }
});