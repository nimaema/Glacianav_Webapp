import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server.js + trimmed
  // node_modules — so the production Docker image doesn't need a full
  // `npm install`. Same technique the CRM app's Dockerfile relies on.
  output: "standalone",
};

export default nextConfig;
