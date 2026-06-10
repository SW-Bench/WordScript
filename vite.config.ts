/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
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
    projects: [{
      extends: true,
      test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        css: true
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});