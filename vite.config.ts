import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1428,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3142" },
  },
  build: { target: "es2022" },
});
