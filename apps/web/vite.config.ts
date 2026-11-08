import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        // Preserve the browser's origin host for the local demo access guard.
        changeOrigin: false,
      },
    },
  },
  build: { chunkSizeWarningLimit: 650 },
});
