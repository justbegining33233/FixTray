import type { MetadataRoute } from "next";
import { HELP_ARTICLES, helpArticlePath } from "@/lib/helpCenter";
import { publicCanonicalUrl } from "@/lib/publicMetadata";

const paths = [
  "/",
  "/features",
  "/about",
  "/contact",
  "/demo",
  "/security",
  "/privacy",
  "/terms",
  "/get-started",
  "/help",
  ...HELP_ARTICLES.map((article) => helpArticlePath(article.slug)),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: publicCanonicalUrl(path),
  }));
}
