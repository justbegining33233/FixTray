// Enterprise Features Integration
// Integrates all 10/10 enterprise features into the FixTray application

import { complianceManager, complianceScheduler } from './compliance';
import { chaosEngine, chaosScheduler, predefinedExperiments } from './chaos';
import { serviceMesh } from './serviceMesh';
import { regionManager, dataReplicationManager, disasterRecoveryManager } from './multiRegion';
import logger from './logger';
import { featureFlags } from './featureFlags';
import { apiVersioning } from './apiVersioning';
import { queryCache } from './queryCache';
import { compression } from './compression';

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build' || process.env.npm_lifecycle_event === 'build';
}

function shouldAutoInitializeEnterprise(): boolean {
  if (typeof window !== 'undefined' || isBuildPhase()) return false;
  if (process.env.NODE_ENV === 'production') {
    return process.env.ENABLE_ENTERPRISE_BOOTSTRAP === 'true';
  }
  return true;
}

function shouldRunReplication(): boolean {
  if (isBuildPhase()) return false;
  if (process.env.ENABLE_MULTI_REGION_REPLICATION === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

class EnterpriseIntegration {
  private initialized = false;

  // Initialize all enterprise features
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing enterprise features...');

      // 1. Start compliance monitoring
      await complianceManager.runAllChecks();
      complianceScheduler.scheduleChecks();

      // 2. Initialize chaos engineering (in development/test environments only)
      if (process.env.NODE_ENV === 'development' || process.env.CHAOS_ENABLED === 'true') {
        // Schedule some chaos experiments for testing
        chaosScheduler.scheduleExperiment(predefinedExperiments[0], '0 2 * * *'); // Daily at 2 AM
      }

      // 3. Register services with service mesh
      this.registerServices();

      // 4. Start data replication only when explicitly enabled for the runtime.
      if (shouldRunReplication()) {
        await dataReplicationManager.syncData();
      } else {
        logger.info('Skipping multi-region replication bootstrap for this runtime');
      }

      // 5. Initialize feature flags
      await this.initializeFeatureFlags();

      // 6. Set up API versioning
      this.setupApiVersioning();

      // 7. Configure compression
      this.setupCompression();

      // 8. Set up multi-region monitoring
      this.setupMultiRegionMonitoring();

      this.initialized = true;
      logger.info('All enterprise features initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize enterprise features', error);
      throw error;
    }
  }

  private registerServices(): void {
    // Register API service
    serviceMesh.getRegistry().register({
      id: 'api-1',
      name: 'api',
      host: process.env.API_HOST || 'localhost',
      port: parseInt(process.env.API_PORT || '3000'),
      health: 'healthy',
      metadata: { version: '1.0.0' },
      lastHealthCheck: new Date(),
      weight: 100
    });

    // Register database service
    serviceMesh.getRegistry().register({
      id: 'db-1',
      name: 'database',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      health: 'healthy',
      metadata: { type: 'postgresql' },
      lastHealthCheck: new Date(),
      weight: 100
    });

    // Register cache service
    serviceMesh.getRegistry().register({
      id: 'cache-1',
      name: 'cache',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      health: 'healthy',
      metadata: { type: 'redis' },
      lastHealthCheck: new Date(),
      weight: 100
    });

    // Register service endpoints
    serviceMesh.registerEndpoint({
      service: 'api',
      method: 'GET',
      path: '/api/workorders',
      timeout: 5000,
      retries: 3,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        successThreshold: 2
      }
    });

    serviceMesh.registerEndpoint({
      service: 'api',
      method: 'POST',
      path: '/api/workorders',
      timeout: 10000,
      retries: 2
    });
  }

  private async initializeFeatureFlags(): Promise<void> {
    // Initialize feature flags with default values
    await featureFlags.setFlag('new_dashboard', true, 100);

    await featureFlags.setFlag('advanced_analytics', false, 0);

    await featureFlags.setFlag('beta_features', false, 10);
  }

  private setupApiVersioning(): void {
    // Set up API versioning middleware
    apiVersioning.setDefaultVersion('v1');
    apiVersioning.addVersion('v1', {
      supported: true,
      deprecated: false,
      sunsetDate: null
    });
  }

  private setupCompression(): void {
    // Configure compression for different content types
    compression.configure({
      threshold: 1024, // Compress responses > 1KB
      level: 6, // Compression level
      enabled: true
    });
  }

  private setupMultiRegionMonitoring(): void {
    // Set up monitoring for multi-region deployment
    setInterval(() => {
      const stats = regionManager.getStats();
      logger.info('Multi-region status', stats);
    }, 300000); // Log every 5 minutes
  }

  // Get comprehensive system health status
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
  }> {
    const components = {
      compliance: complianceManager.getComplianceStatus(),
      serviceMesh: serviceMesh.getStats(),
      regions: regionManager.getStats(),
      replication: dataReplicationManager.getReplicationStatus(),
      cache: await queryCache.getStats(),
      features: featureFlags.getAllFlags()
    };

    // Determine overall health
    const unhealthyComponents = Object.values(components).filter(component => {
      if (typeof component === 'object' && component !== null) {
        const c = component as Record<string, unknown>;
        return c.overall === 'non_compliant' ||
               c.status === 'error' ||
               c.activeRegions === 0;
      }
      return false;
    });

    const overall = unhealthyComponents.length === 0 ? 'healthy' :
                   unhealthyComponents.length <= 2 ? 'degraded' : 'unhealthy';

    return { overall, components };
  }

  // Run chaos experiment (for testing purposes)
  async runChaosExperiment(experimentId: string): Promise<any> {
    const experiment = predefinedExperiments.find(e => e.id === experimentId);
    if (!experiment) {
      throw new Error(`Chaos experiment not found: ${experimentId}`);
    }

    return await chaosEngine.runExperiment(experiment);
  }

  // Trigger regional failover
  async triggerRegionalFailover(toRegion: string, reason: string): Promise<boolean> {
    return await regionManager.manualFailover(toRegion, reason);
  }

  // Execute disaster recovery plan
  async executeDisasterRecovery(planId: string): Promise<any> {
    return await disasterRecoveryManager.executeRecovery(planId);
  }

  // Get enterprise metrics
  getEnterpriseMetrics(): {
    timestamp: Date;
    features: Record<string, any>;
  } {
    return {
      timestamp: new Date(),
      features: {
        compliance: complianceManager.getComplianceStatus(),
        chaos: {
          activeExperiments: chaosEngine.getActiveExperiments().length,
          totalExperiments: predefinedExperiments.length
        },
        serviceMesh: serviceMesh.getStats(),
        multiRegion: regionManager.getStats(),
        featureFlags: featureFlags.getAllFlags(),
        apiVersioning: apiVersioning.getStats(),
        queryCache: { memoryCacheSize: 0 },
        compression: compression.getStats(),
        i18n: {
          supportedLocales: ['en', 'es'],
          defaultLocale: 'en'
        }
      }
    };
  }

  // Cleanup all enterprise features
  async cleanup(): Promise<void> {
    logger.info('Cleaning up enterprise features...');

    complianceScheduler.stop();
    chaosScheduler.stopAll();
    serviceMesh.destroy();
    regionManager.destroy();

    this.initialized = false;
    logger.info('Enterprise features cleanup completed');
  }
}

// Export singleton instance
export const enterprise = new EnterpriseIntegration();

// Initialize enterprise features when module is loaded
if (shouldAutoInitializeEnterprise()) {
  enterprise.initialize().catch(error => {
    console.error('Failed to initialize enterprise features:', error);
  });
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await enterprise.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await enterprise.cleanup();
    process.exit(0);
  });
}