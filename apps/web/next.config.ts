import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Monorepo: la raíz del repo es el root para el file tracing.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // simple-git (usado por @competitor-seeker/core) se queda fuera del bundle.
  serverExternalPackages: ["simple-git"],
  // El core se consume como TS fuente desde el workspace.
  transpilePackages: ["@competitor-seeker/core"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
