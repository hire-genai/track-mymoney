import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // pdf-parse / pdfjs-dist ship a worker file that Turbopack cannot bundle for
  // the server runtime. Mark them external so Node resolves them from node_modules
  // and finds pdf.worker.mjs via the real package layout.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
