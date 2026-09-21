export type TabTarget = { href: string };

function pathOnly(href: string): string {
  return href.split('?')[0].split('#')[0];
}

export function tabMatchesPath(href: string, pathname: string): boolean {
  const path = pathOnly(href);
  if (!path || path === '/') return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** First matching tab wins so two items that share a URL cannot both look active. */
export function exclusiveActiveIndex(tabs: TabTarget[], pathname: string): number {
  return tabs.findIndex((tab) => tabMatchesPath(tab.href, pathname));
}
