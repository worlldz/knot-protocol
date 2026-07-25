import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes: Array<[path: string, priority: number]> = [
    ["", 1],
    ["/.well-known/knot", 0.72],
    ["/api/openapi", 0.7],
    ["/api/manifest", 0.7],
    ["/api/submission", 0.82],
    ["/api/launch", 0.82],
    ["/api/system/status", 0.62],
  ];

  return publicRoutes.map(([path, priority]) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority,
  }));
}
