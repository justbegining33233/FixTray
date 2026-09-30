import type { MetadataRoute } from "next";

const paths = ["/", "/features", "/about", "/contact", "/security", "/privacy", "/terms", "/get-started"];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: path === "/" ? "https://fixtray.app/" : `https://fixtray.app${path}`,
  }));
}
