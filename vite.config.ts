import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  // Tauri expects a fixed port, fail if that port is not available
  clearScreen: false,
  server: {
    port: 1460,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1461 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**", "**/branding/**", "**/testdata/**", "**/release/**", "**/.git/**"] },
  },
}));
