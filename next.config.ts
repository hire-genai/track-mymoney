import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // unpdf bundles a serverless pdfjs-dist build. Mark it external so Next doesn't
  // try to re-bundle it and so Node resolves it from node_modules at runtime.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
