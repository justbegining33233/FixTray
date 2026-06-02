// Chaos Engineering System
// Implements controlled fault injection and resilience testing

import logger from './logger';

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  target: 'database' | 'api' | 'cache' | 'external_service' | 'network';
  faultType: 'delay' | 'error' | 'timeout' | 'resource_exhaustion' | 'data_corruption';
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  duration: number; // milliseconds
  probability: number; // 0-1
  conditions?: ChaosCondition[];
  blastRadius: 'single_service' | 'multiple_services' | 'entire_system';
  rollbackStrategy: 'immediate' | 'gradual' | 'manual';
}

export interface ChaosCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration?: number; // milliseconds
}

export interface ChaosResult {
  experimentId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  metrics: ChaosMetrics;
  incidents: ChaosIncident[];
  recoveryTime?: number; // milliseconds
}

export interface ChaosMetrics {
  errorRate: number;
  responseTime: number;
  throughput: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  customMetrics: Record<string, number>;
}

export interface ChaosIncident {
  timestamp: Date;
  type: 'error' | 'timeout' | 'resource_exhaustion' | 'data_loss';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  recoveryAction?: string;
}

class ChaosEngine {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private activeExperiments: Map<string, ChaosResult> = new Map();
  private faultInjectors: Map<string, FaultInjector> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeFaultInjectors();
    this.startMonitoring();
  }

  private initializeFaultInjectors() {
    // Database fault injector
    this.faultInjectors.set('database', new DatabaseFaultInjector());

    // API fault injector
    this.faultInjectors.set('api', new ApiFaultInjector());

    // Cache fault injector
    this.faultInjectors.set('cache', new CacheFaultInjector());

    // External service fault injector
    this.faultInjectors.set('external_service', new ExternalServiceFaultInjector());

    // Network fault injector
    this.faultInjectors.set('network', new NetworkFaultInjector());
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.monitorActiveExperiments();
    }, 5000); // Check every 5 seconds
  }

  // Run chaos experiment
  async runExperiment(experiment: ChaosExperiment): Promise<ChaosResult> {
    logger.info('Starting chaos experiment', {
      experimentId: experiment.id,
      name: experiment.name,
      target: experiment.target,
      faultType: experiment.faultType
    });

    const result: ChaosResult = {
      experimentId: experiment.id,
      startTime: new Date(),
      status: 'running',
      metrics: await this.captureBaselineMetrics(),
      incidents: []
    };

    this.activeExperiments.set(experiment.id, result);
    this.experiments.set(experiment.id, experiment);

    try {
      // Check safety conditions before starting
      if (!(await this.checkSafetyConditions(experiment))) {
        throw new Error('Safety conditions not met for chaos experiment');
      }

      // Start fault injection
      const injector = this.faultInjectors.get(experiment.target);
      if (!injector) {
        throw new Error(`No fault injector available for target: ${experiment.target}`);
      }

      await injector.injectFault(experiment);

      // Wait for experiment duration
      await this.wait(experiment.duration);

      // Stop fault injection
      await injector.stopFault(experiment.id);

      // Capture final metrics
      result.metrics = await this.captureMetrics();
      result.endTime = new Date();
      result.recoveryTime = await this.measureRecoveryTime(experiment);
      result.status = 'completed';

      logger.info('Chaos experiment completed successfully', {
        experimentId: experiment.id,
        duration: experiment.duration,
        recoveryTime: result.recoveryTime,
        incidents: result.incidents.length
      });

    } catch (error) {
      logger.error('Chaos experiment failed', error, {
        experimentId: experiment.id
      });

      result.status = 'failed';
      result.endTime = new Date();

      // Attempt rollback
      await this.rollbackExperiment(experiment.id);
    }

    this.activeExperiments.delete(experiment.id);
    return result;
  }

  // Stop experiment and rollback
  async stopExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    const result = this.activeExperiments.get(experimentId);

    if (!experiment || !result) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    logger.info('Stopping chaos experiment', { experimentId });

    // Stop fault injection
    const injector = this.faultInjectors.get(experiment.target);
    if (injector) {
      await injector.stopFault(experimentId);
    }

    // Mark as rolled back
    result.status = 'rolled_back';
    result.endTime = new Date();

    this.activeExperiments.delete(experimentId);
  }

  private async checkSafetyConditions(experiment: ChaosExperiment): Promise<boolean> {
    // Check system health
    const healthMetrics = await this.captureMetrics();

    // Don't run if system is already degraded
    if (healthMetrics.errorRate > 0.05) { // 5% error rate threshold
      logger.warn('Skipping chaos experiment due to high error rate', {
        errorRate: healthMetrics.errorRate,
        experimentId: experiment.id
      });
      return false;
    }

    // Check resource usage
    if (healthMetrics.resourceUsage.cpu > 90 ||
        healthMetrics.resourceUsage.memory > 90) {
      logger.warn('Skipping chaos experiment due to high resource usage', {
        cpu: healthMetrics.resourceUsage.cpu,
        memory: healthMetrics.resourceUsage.memory,
        experimentId: experiment.id
      });
      return false;
    }

    // Check custom conditions
    if (experiment.conditions) {
      for (const condition of experiment.conditions) {
        const metricValue = healthMetrics.customMetrics[condition.metric];
        if (!this.evaluateCondition(metricValue, condition)) {
          logger.warn('Safety condition not met', {
            condition,
            actualValue: metricValue,
            experimentId: experiment.id
          });
          return false;
        }
      }
    }

    return true;
  }

  private evaluateCondition(value: number, condition: ChaosCondition): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'eq': return value === condition.value;
      case 'gte': return value >= condition.value;
      case 'lte': return value <= condition.value;
      default: return false;
    }
  }

  private async captureBaselineMetrics(): Promise<ChaosMetrics> {
    // In a real implementation, this would collect actual metrics
    return {
      errorRate: 0.01,
      responseTime: 150,
      throughput: 1000,
      resourceUsage: {
        cpu: 45,
        memory: 60,
        disk: 30,
        network: 25
      },
      customMetrics: {
        activeUsers: 150,
        queueDepth: 5,
        cacheHitRate: 0.85
      }
    };
  }

  private async captureMetrics(): Promise<ChaosMetrics> {
    // In a real implementation, this would collect current metrics
    return {
      errorRate: Math.random() * 0.1,
      responseTime: 150 + Math.random() * 200,
      throughput: 1000 - Math.random() * 200,
      resourceUsage: {
        cpu: 45 + Math.random() * 30,
        memory: 60 + Math.random() * 25,
        disk: 30 + Math.random() * 20,
        network: 25 + Math.random() * 50
      },
      customMetrics: {
        activeUsers: 150 + Math.random() * 50,
        queueDepth: Math.random() * 20,
        cacheHitRate: 0.85 - Math.random() * 0.2
      }
    };
  }

  private async measureRecoveryTime(_experiment: ChaosExperiment): Promise<number> {
    const startTime = Date.now();

    // Wait for system to stabilize
    let stable = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (!stable && attempts < maxAttempts) {
      await this.wait(5000); // Check every 5 seconds
      const metrics = await this.captureMetrics();

      // Consider system stable if error rate is back to normal
      stable = metrics.errorRate < 0.05;
      attempts++;
    }

    return Date.now() - startTime;
  }

  private async monitorActiveExperiments(): Promise<void> {
    for (const [experimentId, result] of this.activeExperiments) {
      try {
        const metrics = await this.captureMetrics();

        // Check for incidents
        if (metrics.errorRate > 0.1) { // 10% error rate threshold
          result.incidents.push({
            timestamp: new Date(),
            type: 'error',
            severity: 'high',
            description: `High error rate detected: ${metrics.errorRate}`,
            affectedComponents: ['api', 'database']
          });
        }

        // Auto-rollback if system becomes critical
        if (metrics.errorRate > 0.25 || metrics.resourceUsage.memory > 95) {
          logger.error('Critical system state detected, auto-rolling back experiment', {
            experimentId,
            errorRate: metrics.errorRate,
            memoryUsage: metrics.resourceUsage.memory
          });

          await this.stopExperiment(experimentId);
        }

      } catch (error) {
        logger.error('Failed to monitor experiment', error, { experimentId });
      }
    }
  }

  private async rollbackExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    logger.info('Rolling back chaos experiment', { experimentId });

    const injector = this.faultInjectors.get(experiment.target);
    if (injector) {
      await injector.rollbackFault(experimentId);
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get experiment results
  getExperimentResult(experimentId: string): ChaosResult | undefined {
    return this.activeExperiments.get(experimentId);
  }

  // Get all active experiments
  getActiveExperiments(): ChaosResult[] {
    return Array.from(this.activeExperiments.values());
  }

  // Cleanup
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Stop all active experiments
    for (const experimentId of this.activeExperiments.keys()) {
      this.stopExperiment(experimentId).catch(error => {
        logger.error('Failed to stop experiment during cleanup', error, { experimentId });
      });
    }
  }
}

// Fault Injector Interfaces
interface FaultInjector {
  injectFault(experiment: ChaosExperiment): Promise<void>;
  stopFault(experimentId: string): Promise<void>;
  rollbackFault(experimentId: string): Promise<void>;
}

class DatabaseFaultInjector implements FaultInjector {
  async injectFault(experiment: ChaosExperiment): Promise<void> {
    // Implementation would inject database faults (delays, connection issues, etc.)
    logger.info('Injecting database fault', {
      experimentId: experiment.id,
      faultType: experiment.faultType
    });
  }

  async stopFault(experimentId: string): Promise<void> {
    logger.info('Stopping database fault', { experimentId });
  }

  async rollbackFault(experimentId: string): Promise<void> {
    logger.info('Rolling back database fault', { experimentId });
  }
}

class ApiFaultInjector implements FaultInjector {
  async injectFault(experiment: ChaosExperiment): Promise<void> {
    logger.info('Injecting API fault', {
      experimentId: experiment.id,
      faultType: experiment.faultType
    });
  }

  async stopFault(experimentId: string): Promise<void> {
    logger.info('Stopping API fault', { experimentId });
  }

  async rollbackFault(experimentId: string): Promise<void> {
    logger.info('Rolling back API fault', { experimentId });
  }
}

class CacheFaultInjector implements FaultInjector {
  async injectFault(experiment: ChaosExperiment): Promise<void> {
    logger.info('Injecting cache fault', {
      experimentId: experiment.id,
      faultType: experiment.faultType
    });
  }

  async stopFault(experimentId: string): Promise<void> {
    logger.info('Stopping cache fault', { experimentId });
  }

  async rollbackFault(experimentId: string): Promise<void> {
    logger.info('Rolling back cache fault', { experimentId });
  }
}

class ExternalServiceFaultInjector implements FaultInjector {
  async injectFault(experiment: ChaosExperiment): Promise<void> {
    logger.info('Injecting external service fault', {
      experimentId: experiment.id,
      faultType: experiment.faultType
    });
  }

  async stopFault(experimentId: string): Promise<void> {
    logger.info('Stopping external service fault', { experimentId });
  }

  async rollbackFault(experimentId: string): Promise<void> {
    logger.info('Rolling back external service fault', { experimentId });
  }
}

class NetworkFaultInjector implements FaultInjector {
  async injectFault(experiment: ChaosExperiment): Promise<void> {
    logger.info('Injecting network fault', {
      experimentId: experiment.id,
      faultType: experiment.faultType
    });
  }

  async stopFault(experimentId: string): Promise<void> {
    logger.info('Stopping network fault', { experimentId });
  }

  async rollbackFault(experimentId: string): Promise<void> {
    logger.info('Rolling back network fault', { experimentId });
  }
}

// Predefined chaos experiments
export const predefinedExperiments: ChaosExperiment[] = [
  {
    id: 'db-connection-loss',
    name: 'Database Connection Loss',
    description: 'Simulate database connection failures',
    target: 'database',
    faultType: 'error',
    intensity: 'medium',
    duration: 30000, // 30 seconds
    probability: 0.5,
    blastRadius: 'single_service',
    rollbackStrategy: 'immediate'
  },

  {
    id: 'api-delay-spike',
    name: 'API Response Delay Spike',
    description: 'Introduce artificial delays in API responses',
    target: 'api',
    faultType: 'delay',
    intensity: 'high',
    duration: 60000, // 1 minute
    probability: 0.3,
    blastRadius: 'multiple_services',
    rollbackStrategy: 'gradual'
  },

  {
    id: 'cache-failure',
    name: 'Cache Service Failure',
    description: 'Simulate cache service unavailability',
    target: 'cache',
    faultType: 'timeout',
    intensity: 'high',
    duration: 45000, // 45 seconds
    probability: 0.4,
    blastRadius: 'entire_system',
    rollbackStrategy: 'immediate'
  },

  {
    id: 'external-service-timeout',
    name: 'External Service Timeout',
    description: 'Simulate external service timeouts',
    target: 'external_service',
    faultType: 'timeout',
    intensity: 'medium',
    duration: 20000, // 20 seconds
    probability: 0.6,
    blastRadius: 'single_service',
    rollbackStrategy: 'immediate'
  }
];

// Export singleton instance
export const chaosEngine = new ChaosEngine();

// Chaos experiment scheduler
export class ChaosScheduler {
  private schedule: Map<string, NodeJS.Timeout> = new Map();

  scheduleExperiment(experiment: ChaosExperiment, _cronExpression: string): void {
    // In a real implementation, this would parse cron expressions
    // For now, just schedule to run once per day
    const interval = 24 * 60 * 60 * 1000; // 24 hours

    const timer = setInterval(async () => {
      try {
        // Only run during off-peak hours (2-4 AM)
        const hour = new Date().getHours();
        if (hour >= 2 && hour <= 4) {
          await chaosEngine.runExperiment(experiment);
        }
      } catch (error) {
        logger.error('Scheduled chaos experiment failed', error, {
          experimentId: experiment.id
        });
      }
    }, interval);

    this.schedule.set(experiment.id, timer);
    logger.info('Scheduled chaos experiment', {
      experimentId: experiment.id,
      interval: 'daily'
    });
  }

  stopExperiment(experimentId: string): void {
    const timer = this.schedule.get(experimentId);
    if (timer) {
      clearInterval(timer);
      this.schedule.delete(experimentId);
      logger.info('Stopped scheduled chaos experiment', { experimentId });
    }
  }

  stopAll(): void {
    for (const [experimentId, timer] of this.schedule) {
      clearInterval(timer);
      logger.info('Stopped scheduled chaos experiment', { experimentId });
    }
    this.schedule.clear();
  }
}

export const chaosScheduler = new ChaosScheduler();