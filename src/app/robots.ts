import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/.well-known/knot",
        "/api/openapi",
        "/api/manifest",
        "/api/submission",
        "/api/launch",
        "/api/marketplace",
        "/api/system/status",
      ],
      disallow: [
        "/api/agents",
        "/api/executions",
        "/api/providers",
        "/api/quote",
        "/api/receipts",
        "/api/x402",
      ],
    },
    sitemap: `${siteUrl.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
