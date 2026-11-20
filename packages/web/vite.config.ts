import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Windows checkouts may give index.html CRLF line endings; Vite would mix them
// with its own LF lines, and git cannot normalize the result. Building from LF
// keeps the shipped page identical on every platform.
const lfHtml = {
  name: "lf-html",
  transformIndexHtml: { order: "pre" as const, handler: (html: string) => html.replace(/\r\n?/g, "\n") },
};

export default defineConfig({
  plugins: [react(), lfHtml],
  server: {
    proxy: {
      // Preserve the browser's Host so the hub can enforce same-origin requests.
      "/api": { target: "http://localhost:3456", changeOrigin: false },
    },
  },
  build: { outDir: "dist" },
});
