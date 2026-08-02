import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Set BASE_PATH (e.g. "/Parking/") when deploying under a sub-path such as
  // GitHub Pages project sites; defaults to the domain root.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
  },
  server: {
    host: true,
  },
});
