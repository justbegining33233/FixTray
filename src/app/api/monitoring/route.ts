/**
 * Production Monitoring Endpoints
 *
 * These endpoints provide system health and metrics for:
 * - Kubernetes liveness/readiness probes
 * - Load balancer health checks
 * - External monitoring systems
 * - Sentry dashboards
 *
 * These do NOT require authentication (needed for load balancers)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============================================================================
// LIVENESS PROBE - Is the service running?
// ============================================================================

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Route to appropriate handler
  if (pathname.includes('/monitoring/liveness')) {
    return handleLivenessProbe(request);
  }
  if (pathname.includes('/monitoring/readiness')) {
    return handleReadinessProbe(request);
  }
  if (pathname.includes('/monitoring/metrics')) {
    return handleMetrics(request);
  }

  // Default to liveness
  return handleLivenessProbe(request);
}

// ============================================================================
// LIVENESS PROBE (K8s)
// ============================================================================

async function handleLivenessProbe(request: NextRequest) {
  // Very simple check: Is the application process running?
  // Should only be false if the process is completely dead
  
  return NextResponse.json(
    {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    },
    { status: 200 }
  );
}

// ============================================================================
// READINESS PROBE (K8s)
// ============================================================================

async function handleReadinessProbe(request: NextRequest) {
  // Is the service ready to accept traffic?
  // More strict than liveness - checks dependencies
  
  const readiness = {
    ready: true,
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
    },
  };

  try {
    // Database must be responding
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbTime = Date.now() - start;
    
    readiness.checks.database = true;
    
    // If DB is slow, mark as not ready
    if (dbTime > 5000) {
      readiness.ready = false;
    }
  } catch (error) {
    readiness.ready = false;
  }

  const status = readiness.ready ? 200 : 503;
  return NextResponse.json(readiness, { status });
}

// ============================================================================
// METRICS ENDPOINT (for Prometheus/monitoring)
// ============================================================================

async function handleMetrics(request: NextRequest) {
  // Prometheus-format metrics for scraping
  
  const metrics: string[] = [];
  const timestamp = Date.now();

  // System metrics
  const memUsage = process.memoryUsage();
  metrics.push(`# HELP app_memory_heap_used Heap memory used in bytes`);
  metrics.push(`# TYPE app_memory_heap_used gauge`);
  metrics.push(`app_memory_heap_used ${memUsage.heapUsed}`);

  metrics.push(`# HELP app_memory_heap_total Heap memory total in bytes`);
  metrics.push(`# TYPE app_memory_heap_total gauge`);
  metrics.push(`app_memory_heap_total ${memUsage.heapTotal}`);

  metrics.push(`# HELP app_uptime_seconds Application uptime in seconds`);
  metrics.push(`# TYPE app_uptime_seconds gauge`);
  metrics.push(`app_uptime_seconds ${process.uptime()}`);

  metrics.push(`# HELP app_deployment_info Deployment info`);
  metrics.push(`# TYPE app_deployment_info gauge`);
  metrics.push(
    `app_deployment_info{version="${process.env.DEPLOYMENT_VERSION || 'unknown'}",environment="${process.env.NODE_ENV}"} 1`
  );

  // Return in Prometheus format
  return new NextResponse(metrics.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
}

export async function POST(request: NextRequest) {
  // Accept monitoring pings
  return NextResponse.json({ received: true, timestamp: new Date() });
}
