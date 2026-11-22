import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and no automatic clearing of the console.
const buildStamp = new Date().toISOString().slice(0, 16).replace("T", " ");

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "chrome110",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
