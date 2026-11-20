// The exported component map page: one script and one stylesheet with no
// chunks, so `srev map export` can inline them into a single HTML file.
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
  // The page links nothing, so public files (served by the hub) stay out.
  publicDir: false,
  build: {
    outDir: "dist/export",
    emptyOutDir: true,
    rollupOptions: {
      input: "export.html",
      output: {
        inlineDynamicImports: true,
        entryFileNames: "map.js",
        assetFileNames: "map[extname]",
      },
    },
  },
});
