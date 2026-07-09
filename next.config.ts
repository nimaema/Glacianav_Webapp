import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server.js + trimmed
  // node_modules — so the production Docker image doesn't need a full
  // `npm install`. Same technique the CRM app's Dockerfile relies on.
  output: "standalone",
};

// NOTE (package.json's "build" script): `next build` now defaults to
// Turbopack in Next 16. Hit a real, reproduced bug building on amd64
// (GitHub Actions runners, and the production server — both native
// hardware, not emulation): src/proxy.ts (the auth-gating route
// interceptor) compiled and ran correctly on arm64 (local Mac builds) but
// was silently never registered on amd64 — same source, same Dockerfile,
// different bundler output. Forcing `--webpack` (package.json's build
// script) resolved it identically on both architectures. Revisit dropping
// this once Turbopack's proxy/middleware handling has matured past 16.2.10.

export default nextConfig;
