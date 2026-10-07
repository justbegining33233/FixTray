import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN } from "@/lib/publicMetadata";
import { PRIVATE_PATH_PREFIXES } from "@/lib/searchIndexing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PATH_PREFIXES],
    },
    sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
  };
}
