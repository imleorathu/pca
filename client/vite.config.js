import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "fresh-local-media",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (/\.(mp4|webm)(\?.*)?$/i.test(request.url || "")) {
            response.setHeader("Cache-Control", "no-store, max-age=0");
          }
          next();
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
