import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // We use pdfjs-dist directly from the import route to extract PDF text.
  // Marking it external keeps Turbopack from trying to bundle its ESM worker
  // and standard-font loader — Node resolves them from node_modules at runtime.
  serverExternalPackages: ["pdfjs-dist"],
  // Vercel's output tracer sometimes drops pdfjs-dist's optional runtime files
  // (worker, standard fonts, cmaps) because we import only the main entry.
  // Force-include them so getDocument() can find them inside the serverless
  // function bundle.
  outputFileTracingIncludes: {
    "/api/import/parse": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
    ],
  },
};

export default nextConfig;
