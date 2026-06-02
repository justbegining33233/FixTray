import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

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

function parseVersionFromFileName(fileName: string): string | null {
  const match = fileName.match(/(?:VERSION_|CHANGELOG-v)(\d+\.\d+\.\d+)\.md$/i);
  if (!match) return null;
  return `v${match[1]}`;
}

async function buildDeploymentHistory(): Promise<DeploymentRecord[]> {
  const docsDir = path.join(process.cwd(), 'docs');
  const history: DeploymentRecord[] = [];

  try {
    const files = await fs.readdir(docsDir);
    const candidates = files.filter((file) => /^(VERSION_|CHANGELOG-v).*\.md$/i.test(file));

    for (const fileName of candidates) {
      const version = parseVersionFromFileName(fileName);
      if (!version) continue;

      const fullPath = path.join(docsDir, fileName);
      const stats = await fs.stat(fullPath);

      history.push({
        id: `docs-${fileName}`,
        version,
        environment: 'Production',
        status: 'success',
        timestamp: stats.mtime.toISOString(),
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

  const deployments = await buildDeploymentHistory();

  if (deployments.length > 0) {
    return NextResponse.json({
      currentVersion: deployments[0].version,
      deployments,
    });
  }

  return NextResponse.json({
    currentVersion: 'unknown',
    deployments: [],
  });
}
