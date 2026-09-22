import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';
import { parseDeploymentDoc } from '@/lib/deploymentHistory';

type DeploymentStatus = 'success' | 'failed' | 'in-progress' | 'pending';

type DeploymentRecord = {
  id: string;
  version: string;
  environment: 'Production';
  status: DeploymentStatus;
  timestamp: string;
  deployer: string;
  source: string;
};

async function currentPackageVersion(): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8');
    const version = (JSON.parse(raw) as { version?: string }).version;
    return version ? `v${version}` : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function buildDeploymentHistory(): Promise<DeploymentRecord[]> {
  const docsDir = path.join(process.cwd(), 'docs');
  const history: DeploymentRecord[] = [];

  try {
    const files = await fs.readdir(docsDir);
    const candidates = files.filter((file) => /^(VERSION_|CHANGELOG-v).*\.md$/i.test(file));

    for (const fileName of candidates) {
      const fullPath = path.join(docsDir, fileName);
      const [markdown, stats] = await Promise.all([
        fs.readFile(fullPath, 'utf8'),
        fs.stat(fullPath),
      ]);
      const parsed = parseDeploymentDoc(markdown, fileName, stats.mtime);
      if (!parsed) continue;

      history.push({
        id: `docs-${fileName}`,
        version: parsed.version,
        environment: 'Production',
        status: 'success',
        timestamp: parsed.timestamp,
        deployer: 'System',
        source: `docs/${fileName}`,
      });
    }
  } catch {
    // Gracefully return an empty list when docs files are unavailable.
  }

  history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const byVersion = new Map<string, DeploymentRecord>();
  for (const item of history) {
    if (!byVersion.has(item.version)) {
      byVersion.set(item.version, item);
    }
  }

  return [...byVersion.values()];
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['admin', 'superadmin']);
  if (auth instanceof NextResponse) return auth;

  const [deployments, currentVersion] = await Promise.all([
    buildDeploymentHistory(),
    currentPackageVersion(),
  ]);

  return NextResponse.json({
    currentVersion,
    deployments,
  });
}
