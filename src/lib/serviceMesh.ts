// Service Mesh Implementation
// Provides service discovery, load balancing, circuit breaking, and distributed tracing

import logger from './logger';

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  health: 'healthy' | 'unhealthy' | 'unknown';
  metadata: Record<string, any>;
  lastHealthCheck: Date;
  weight: number; // For load balancing
}

export interface ServiceEndpoint {
  service: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  timeout: number;
  retries: number;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before trying again
  successThreshold: number; // Number of successes needed to close
}

export interface LoadBalancerStrategy {
  name: 'round_robin' | 'weighted_round_robin' | 'least_connections' | 'random';
  select(instances: ServiceInstance[]): ServiceInstance | null;
}

export interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  service: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, any>;
  events: TraceEvent[];
}

export interface TraceEvent {
  timestamp: Date;
  name: string;
  attributes: Record<string, any>;
}

class ServiceRegistry {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.startHealthChecks();
  }

  // Register a service instance
  register(instance: ServiceInstance): void {
    const instances = this.services.get(instance.name) || [];
    const existingIndex = instances.findIndex(i => i.id === instance.id);

    if (existingIndex >= 0) {
      instances[existingIndex] = { ...instance, lastHealthCheck: new Date() };
    } else {
      instances.push({ ...instance, lastHealthCheck: new Date() });
    }

    this.services.set(instance.name, instances);

    logger.info('Service instance registered', {
      service: instance.name,
      instanceId: instance.id,
      host: instance.host,
      port: instance.port
    });
  }

  // Deregister a service instance
  deregister(serviceName: string, instanceId: string): void {
    const instances = this.services.get(serviceName) || [];
    const filtered = instances.filter(i => i.id !== instanceId);

    if (filtered.length !== instances.length) {
      this.services.set(serviceName, filtered);
      logger.info('Service instance deregistered', { serviceName, instanceId });
    }
  }

  // Get healthy instances for a service
  getHealthyInstances(serviceName: string): ServiceInstance[] {
    const instances = this.services.get(serviceName) || [];
    return instances.filter(i => i.health === 'healthy');
  }

  // Get all instances for a service
  getAllInstances(serviceName: string): ServiceInstance[] {
    return this.services.get(serviceName) || [];
  }

  // Update instance health
  updateHealth(serviceName: string, instanceId: string, health: 'healthy' | 'unhealthy'): void {
    const instances = this.services.get(serviceName) || [];
    const instance = instances.find(i => i.id === instanceId);

    if (instance) {
      instance.health = health;
      instance.lastHealthCheck = new Date();

      logger.debug('Service instance health updated', {
        serviceName,
        instanceId,
        health
      });
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    for (const [serviceName, instances] of this.services) {
      for (const instance of instances) {
        try {
          const isHealthy = await this.checkInstanceHealth(instance);
          const newHealth = isHealthy ? 'healthy' : 'unhealthy';

          if (newHealth !== instance.health) {
            this.updateHealth(serviceName, instance.id, newHealth);
          }
        } catch (error) {
          logger.error('Health check failed', error, {
            serviceName,
            instanceId: instance.id
          });
          this.updateHealth(serviceName, instance.id, 'unhealthy');
        }
      }
    }
  }

  private async checkInstanceHealth(instance: ServiceInstance): Promise<boolean> {
    try {
      // In a real implementation, this would make an HTTP health check
      // For now, simulate based on some logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`http://${instance.host}:${instance.port}/health`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ServiceMesh-HealthCheck'
        }
      });
      clearTimeout(timeoutId);

      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  // Get service statistics
  getServiceStats(): Record<string, { total: number; healthy: number; unhealthy: number }> {
    const stats: Record<string, { total: number; healthy: number; unhealthy: number }> = {};

    for (const [serviceName, instances] of this.services) {
      const healthy = instances.filter(i => i.health === 'healthy').length;
      const unhealthy = instances.filter(i => i.health === 'unhealthy').length;

      stats[serviceName] = {
        total: instances.length,
        healthy,
        unhealthy
      };
    }

    return stats;
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

class LoadBalancer {
  private strategies: Map<string, LoadBalancerStrategy> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Round Robin
    this.strategies.set('round_robin', {
      name: 'round_robin',
      select: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;

        const serviceName = instances[0].name;
        const currentIndex = this.roundRobinIndex.get(serviceName) || 0;
        const instance = instances[currentIndex % instances.length];

        this.roundRobinIndex.set(serviceName, (currentIndex + 1) % instances.length);
        return instance;
      }
    });

    // Weighted Round Robin
    this.strategies.set('weighted_round_robin', {
      name: 'weighted_round_robin',
      select: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;

        const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
        let random = Math.random() * totalWeight;

        for (const instance of instances) {
          random -= instance.weight;
          if (random <= 0) {
            return instance;
          }
        }

        return instances[0];
      }
    });

    // Least Connections (simplified)
    this.strategies.set('least_connections', {
      name: 'least_connections',
      select: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;

        // In a real implementation, this would track active connections
        // For now, just pick randomly
        return instances[Math.floor(Math.random() * instances.length)];
      }
    });

    // Random
    this.strategies.set('random', {
      name: 'random',
      select: (instances: ServiceInstance[]) => {
        if (instances.length === 0) return null;
        return instances[Math.floor(Math.random() * instances.length)];
      }
    });
  }

  selectInstance(serviceName: string, strategy: string = 'round_robin', instances?: ServiceInstance[]): ServiceInstance | null {
    const strategyImpl = this.strategies.get(strategy);
    if (!strategyImpl) {
      logger.warn('Unknown load balancing strategy, using round_robin', { strategy });
      return this.strategies.get('round_robin')!.select(instances || []);
    }

    return strategyImpl.select(instances || []);
  }
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half_open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
        logger.info('Circuit breaker closed');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened', {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      });
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  getState(): 'closed' | 'open' | 'half_open' {
    return this.state;
  }

  getStats(): { state: string; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    };
  }
}

class DistributedTracer {
  private spans: Map<string, TraceSpan> = new Map();
  private activeSpanId?: string;

  // Start a new trace span
  startSpan(name: string, service: string, parentId?: string): string {
    const spanId = this.generateId();
    const span: TraceSpan = {
      id: spanId,
      parentId,
      name,
      service,
      startTime: new Date(),
      tags: {},
      events: []
    };

    this.spans.set(spanId, span);
    this.activeSpanId = spanId;

    return spanId;
  }

  // End a trace span
  endSpan(spanId: string): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = new Date();
      span.duration = span.endTime.getTime() - span.startTime.getTime();

      logger.debug('Trace span completed', {
        spanId,
        name: span.name,
        service: span.service,
        duration: span.duration
      });
    }
  }

  // Add tag to span
  addTag(spanId: string, key: string, value: any): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  // Add event to span
  addEvent(spanId: string, name: string, attributes: Record<string, any> = {}): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        timestamp: new Date(),
        name,
        attributes
      });
    }
  }

  // Get span
  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  // Get trace (span and all its children)
  getTrace(rootSpanId: string): TraceSpan[] {
    const trace: TraceSpan[] = [];
    const visited = new Set<string>();

    const collectSpans = (spanId: string) => {
      if (visited.has(spanId)) return;
      visited.add(spanId);

      const span = this.spans.get(spanId);
      if (span) {
        trace.push(span);
        // Find child spans
        for (const [id, s] of this.spans) {
          if (s.parentId === spanId) {
            collectSpans(id);
          }
        }
      }
    };

    collectSpans(rootSpanId);
    return trace;
  }

  // Export trace data (for external tracing systems)
  exportTrace(rootSpanId: string): any {
    const trace = this.getTrace(rootSpanId);
    return {
      traceId: rootSpanId,
      spans: trace.map(span => ({
        spanId: span.id,
        parentSpanId: span.parentId,
        name: span.name,
        serviceName: span.service,
        startTimeUnixNano: span.startTime.getTime() * 1000000,
        endTimeUnixNano: span.endTime ? span.endTime.getTime() * 1000000 : undefined,
        attributes: Object.entries(span.tags).map(([key, value]) => ({
          key,
          value: { stringValue: String(value) }
        })),
        events: span.events.map(event => ({
          name: event.name,
          timeUnixNano: event.timestamp.getTime() * 1000000,
          attributes: Object.entries(event.attributes).map(([key, value]) => ({
            key,
            value: { stringValue: String(value) }
          }))
        }))
      }))
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  // Cleanup old spans
  cleanup(maxAge: number = 3600000): void { // 1 hour default
    const cutoff = Date.now() - maxAge;
    const toDelete: string[] = [];

    for (const [spanId, span] of this.spans) {
      if (span.endTime && span.endTime.getTime() < cutoff) {
        toDelete.push(spanId);
      }
    }

    toDelete.forEach(id => this.spans.delete(id));

    if (toDelete.length > 0) {
      logger.debug('Cleaned up old trace spans', { count: toDelete.length });
    }
  }
}

class ServiceMesh {
  private registry: ServiceRegistry;
  private loadBalancer: LoadBalancer;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private tracer: DistributedTracer;
  private endpoints: Map<string, ServiceEndpoint> = new Map();

  constructor() {
    this.registry = new ServiceRegistry();
    this.loadBalancer = new LoadBalancer();
    this.tracer = new DistributedTracer();

    // Start cleanup interval for traces
    setInterval(() => {
      this.tracer.cleanup();
    }, 300000); // Clean up every 5 minutes
  }

  // Register service endpoint
  registerEndpoint(endpoint: ServiceEndpoint): void {
    const key = `${endpoint.service}:${endpoint.method}:${endpoint.path}`;
    this.endpoints.set(key, endpoint);

    // Initialize circuit breaker if configured
    if (endpoint.circuitBreaker) {
      this.circuitBreakers.set(key, new CircuitBreaker(endpoint.circuitBreaker));
    }

    logger.info('Service endpoint registered', {
      service: endpoint.service,
      method: endpoint.method,
      path: endpoint.path
    });
  }

  // Make service request with mesh features
  async makeRequest(
    service: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      timeout?: number;
      retries?: number;
      loadBalanceStrategy?: string;
      traceId?: string;
    } = {}
  ): Promise<any> {
    const endpointKey = `${service}:${method}:${path}`;
    const endpoint = this.endpoints.get(endpointKey);

    if (!endpoint) {
      throw new Error(`Service endpoint not registered: ${endpointKey}`);
    }

    // Start tracing
    const spanId = this.tracer.startSpan(
      `${method} ${path}`,
      'service-mesh',
      options.traceId
    );

    this.tracer.addTag(spanId, 'service', service);
    this.tracer.addTag(spanId, 'method', method);
    this.tracer.addTag(spanId, 'path', path);

    try {
      // Get healthy instances
      const instances = this.registry.getHealthyInstances(service);
      if (instances.length === 0) {
        throw new Error(`No healthy instances available for service: ${service}`);
      }

      // Select instance using load balancer
      const instance = this.loadBalancer.selectInstance(
        service,
        options.loadBalanceStrategy,
        instances
      );

      if (!instance) {
        throw new Error(`No instance selected for service: ${service}`);
      }

      this.tracer.addTag(spanId, 'instance', `${instance.host}:${instance.port}`);

      // Prepare request
      const url = `http://${instance.host}:${instance.port}${path}`;
      const requestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-Id': spanId,
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        // Note: fetch doesn't have built-in timeout, would need AbortController
      };

      this.tracer.addEvent(spanId, 'request_start', { url, method });

      // Execute with circuit breaker if configured
      const circuitBreaker = this.circuitBreakers.get(endpointKey);
      let response;

      if (circuitBreaker) {
        response = await circuitBreaker.execute(async () => {
          return await fetch(url, requestOptions);
        });
      } else {
        response = await fetch(url, requestOptions);
      }

      this.tracer.addEvent(spanId, 'request_complete', {
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      this.tracer.addTag(spanId, 'status', 'success');
      this.tracer.endSpan(spanId);

      return data;

    } catch (error) {
      this.tracer.addTag(spanId, 'status', 'error');
      this.tracer.addTag(spanId, 'error', (error as Error).message);
      this.tracer.endSpan(spanId);

      throw error;
    }
  }

  // Get service mesh statistics
  getStats(): {
    services: Record<string, any>;
    circuitBreakers: Record<string, any>;
    traces: { activeSpans: number; totalSpans: number };
  } {
    const circuitBreakerStats: Record<string, any> = {};
    for (const [key, cb] of this.circuitBreakers) {
      circuitBreakerStats[key] = cb.getStats();
    }

    return {
      services: this.registry.getServiceStats(),
      circuitBreakers: circuitBreakerStats,
      traces: {
        activeSpans: this.tracer['spans'].size,
        totalSpans: this.tracer['spans'].size // In real impl, track total created
      }
    };
  }

  // Get registry instance for external access
  getRegistry(): ServiceRegistry {
    return this.registry;
  }

  // Get tracer instance for external access
  getTracer(): DistributedTracer {
    return this.tracer;
  }

  destroy(): void {
    this.registry.destroy();
  }
}

// Export singleton instance
export const serviceMesh = new ServiceMesh();

// Service mesh middleware for Next.js API routes
export function withServiceMesh(handler: any) {
  return async (req: any, res: any) => {
    const spanId = serviceMesh.getTracer().startSpan(
      `${req.method} ${req.url}`,
      'api-route'
    );

    serviceMesh.getTracer().addTag(spanId, 'method', req.method);
    serviceMesh.getTracer().addTag(spanId, 'url', req.url);

    try {
      const result = await handler(req, res);

      serviceMesh.getTracer().addTag(spanId, 'status', 'success');
      serviceMesh.getTracer().endSpan(spanId);

      return result;
    } catch (error) {
      serviceMesh.getTracer().addTag(spanId, 'status', 'error');
      serviceMesh.getTracer().addTag(spanId, 'error', (error as Error).message);
      serviceMesh.getTracer().endSpan(spanId);

      throw error;
    }
  };
}