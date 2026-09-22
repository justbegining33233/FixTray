export type ParsedDeployment = {
  version: string;
  timestamp: string;
};

const VERSION_IN_NAME = /(?:VERSION_|CHANGELOG-v)(\d+\.\d+\.\d+)\.md$/i;

/** Prefer the version and date written in the doc. Filesystem mtimes on copied docs can be years stale. */
export function parseDeploymentDoc(markdown: string, fileName: string, mtime: Date): ParsedDeployment | null {
  const versionLine = markdown.match(/\*\*Version:\*\*\s*v?(\d+\.\d+\.\d+)/i);
  const fileVersion = fileName.match(VERSION_IN_NAME);
  const raw = versionLine?.[1] || fileVersion?.[1];
  if (!raw) return null;

  const completion = markdown.match(/\*\*Completion Date:\*\*\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
  const start = markdown.match(/\*\*Start Date:\*\*\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
  const stated = completion?.[1] || start?.[1];
  let timestamp = mtime.toISOString();
  if (stated) {
    const parsed = new Date(stated);
    if (!Number.isNaN(parsed.getTime())) timestamp = parsed.toISOString();
  } else if (mtime.getFullYear() < 2020) {
    timestamp = new Date().toISOString();
  }

  return { version: `v${raw}`, timestamp };
}
