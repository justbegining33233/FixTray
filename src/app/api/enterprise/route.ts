// Enterprise Features API Endpoint
// Provides access to enterprise features management and monitoring

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { enterprise } from '@/lib/enterprise';
import { complianceManager } from '@/lib/compliance';
import { chaosEngine, predefinedExperiments } from '@/lib/chaos';
import { serviceMesh } from '@/lib/serviceMesh';
import { regionManager } from '@/lib/multiRegion';
import { featureFlags } from '@/lib/featureFlags';
import { queryCache } from '@/lib/queryCache';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Only admins can access enterprise features
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        return await getSystemStatus();

      case 'compliance':
        return await getComplianceStatus();

      case 'chaos':
        return await getChaosStatus();

      case 'service-mesh':
        return await getServiceMeshStatus();

      case 'regions':
        return await getRegionsStatus();

      case 'features':
        return await getFeaturesStatus();

      case 'metrics':
        return await getEnterpriseMetrics();

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    logger.error('Enterprise API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Only admins can modify enterprise features
  if (auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'run-chaos-experiment':
        return await runChaosExperiment(params);

      case 'trigger-failover':
        return await triggerFailover(params);

      case 'execute-disaster-recovery':
        return await executeDisasterRecovery(params);

      case 'update-feature-flag':
        return await updateFeatureFlag(params);

      case 'clear-cache':
        return await clearCache(params);

      case 'run-compliance-check':
        return await runComplianceCheck();

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    logger.error('Enterprise API POST error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handler functions
async function getSystemStatus() {
  const health = await enterprise.getSystemHealth();
  return NextResponse.json({
    status: 'success',
    data: health
  });
}

async function getComplianceStatus() {
  const status = complianceManager.getComplianceStatus();
  const violations = await complianceManager.runAllChecks();

  return NextResponse.json({
    status: 'success',
    data: {
      overall: status,
      violations: violations
    }
  });
}

async function getChaosStatus() {
  const activeExperiments = chaosEngine.getActiveExperiments();

  return NextResponse.json({
    status: 'success',
    data: {
      activeExperiments,
      availableExperiments: predefinedExperiments.map(exp => ({
        id: exp.id,
        name: exp.name,
        description: exp.description,
        target: exp.target,
        faultType: exp.faultType
      }))
    }
  });
}

async function getServiceMeshStatus() {
  const stats = serviceMesh.getStats();

  return NextResponse.json({
    status: 'success',
    data: stats
  });
}

async function getRegionsStatus() {
  const stats = regionManager.getStats();

  return NextResponse.json({
    status: 'success',
    data: stats
  });
}

async function getFeaturesStatus() {
  const flags = featureFlags.getAllFlags();

  return NextResponse.json({
    status: 'success',
    data: { flags, totalFlags: flags.length, enabledFlags: flags.filter(f => f.enabled).length }
  });
}

async function getEnterpriseMetrics() {
  const metrics = enterprise.getEnterpriseMetrics();

  return NextResponse.json({
    status: 'success',
    data: metrics
  });
}

async function runChaosExperiment(params: any) {
  const { experimentId } = params;

  if (!experimentId) {
    return NextResponse.json({ error: 'Experiment ID required' }, { status: 400 });
  }

  try {
    const result = await enterprise.runChaosExperiment(experimentId);
    return NextResponse.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function triggerFailover(params: any) {
  const { toRegion, reason } = params;

  if (!toRegion || !reason) {
    return NextResponse.json({ error: 'Region and reason required' }, { status: 400 });
  }

  try {
    const success = await enterprise.triggerRegionalFailover(toRegion, reason);
    return NextResponse.json({
      status: 'success',
      data: { success }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function executeDisasterRecovery(params: any) {
  const { planId } = params;

  if (!planId) {
    return NextResponse.json({ error: 'Plan ID required' }, { status: 400 });
  }

  try {
    const result = await enterprise.executeDisasterRecovery(planId);
    return NextResponse.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function updateFeatureFlag(params: any) {
  const { flagName, enabled, rolloutPercentage } = params;

  if (!flagName) {
    return NextResponse.json({ error: 'Flag name required' }, { status: 400 });
  }

  try {
    featureFlags.setFlag(flagName, enabled ?? true, rolloutPercentage ?? 100);

    return NextResponse.json({
      status: 'success',
      message: `Feature flag ${flagName} updated`
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function clearCache(params: any) {
  const { pattern } = params;

  try {
    if (pattern) {
      await queryCache.invalidate(pattern);
    } else {
      await queryCache.invalidateAll();
    }

    return NextResponse.json({
      status: 'success',
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function runComplianceCheck() {
  try {
    const results = await complianceManager.runAllChecks();
    return NextResponse.json({
      status: 'success',
      data: results
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}