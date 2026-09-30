import type { MetadataRoute } from "next";
import { HELP_ARTICLES, helpArticlePath } from "@/lib/helpCenter";
import { PUBLIC_SITE_ORIGIN } from "@/lib/publicMetadata";

const paths = [
  "/",
  "/features",
  "/about",
  "/contact",
  "/security",
  "/privacy",
  "/terms",
  "/get-started",
  "/help",
  ...HELP_ARTICLES.map((article) => helpArticlePath(article.slug)),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: path === "/" ? `${PUBLIC_SITE_ORIGIN}/` : `${PUBLIC_SITE_ORIGIN}${path}`,
  }));
}
