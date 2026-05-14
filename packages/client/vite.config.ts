import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";
import { corsProxyPlugin } from "./vite-plugins/corsProxy";

/**
 * Capacitor serves assets locally — PWA Service Worker caching causes
 * white-screen issues when asset hashes change between builds because
 * the SW precaches index.html with old references. Disable SW in
 * Capacitor builds entirely.
 *
 * Since the env var doesn't propagate reliably through pnpm subprocess,
 * we also check for the presence of the android/ directory as a heuristic
 * that this project targets Capacitor.
 */
import { existsSync } from "node:fs";
const isCapacitorBuild = process.env["CAPACITOR_BUILD"] === "true"
  || existsSync(resolve(__dirname, "android"))
  || true; // Force disable PWA until web-only deployment is needed

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    corsProxyPlugin(),
    // VitePWA disabled — Capacitor serves assets locally and SW caching
    // causes white-screen issues when asset hashes change between builds.
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          router: ["react-router"],
        },
      },
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
