import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // unpdf bundles a serverless pdfjs-dist build. Mark it external so Next doesn't
  // try to re-bundle it and so Node resolves it from node_modules at runtime.
  serverExternalPackages: ["unpdf"],
  async headers() {
    return [
      {
        // The service worker must never be cached by the browser — every page
        // load must fetch the newest version so updates deploy cleanly.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
