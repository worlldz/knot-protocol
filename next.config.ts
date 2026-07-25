import type { NextConfig } from "next";

const nonRuntimeTraceFiles = [
  ".knot-data/**/*",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "artifacts/**/*",
  "cache/**/*",
  "contracts/**/*",
  "deployments/**/*",
  "docs/**/*",
  "eslint.config.mjs",
  "hardhat.config.ts",
  "next.config.ts",
  "package-lock.json",
  "postcss.config.mjs",
  "public/**/*",
  "recovery/**/*",
  "scripts/**/*",
  "src/**/*",
  "src/**/*.test.ts",
  "test/**/*",
  "tsconfig.json",
  "tsconfig.tsbuildinfo",
];

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/executions": nonRuntimeTraceFiles,
    "/api/executions/[id]": nonRuntimeTraceFiles,
    "/receipt/[id]": nonRuntimeTraceFiles,
  },
};

export default nextConfig;
