import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectManifest: {
        swSrc: "src/sw.js",
        swDest: "dist/sw.js",
      },
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Evergreen — Routine Tracker",
        short_name: "Evergreen",
        description: "Track daily, weekly, and monthly routines on a simple calendar grid.",
        theme_color: "#1B2A1A",
        background_color: "#F1F4EC",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    })
  ]
});
