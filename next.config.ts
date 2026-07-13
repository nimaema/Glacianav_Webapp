import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server.js + trimmed
  // node_modules — so the production Docker image doesn't need a full
  // `npm install`. Same technique the CRM app's Dockerfile relies on.
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "56mb",
    },
    // With middleware present, Next buffers every request body and truncates
    // it at 10MB by default — large audio uploads to /api/recordings/upload
    // then die with "Failed to parse body as FormData" (a 500 in prod).
    // Match the route's own 300MB ceiling, with a little headroom for the
    // multipart envelope.
    proxyClientMaxBodySize: "310mb",
  },
};

export default nextConfig;
