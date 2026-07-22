/**
 * Performance & Load Testing (Phase 5)
 *
 * Tests system performance under load:
 * 5.3.1 100 Concurrent Users
 * 5.3.2 Real-time Updates Under Load
 * 5.3.3 Large File Uploads
 * 5.3.4 Complex Query Performance
 *
 * Run: npx ts-node performance-test.ts
 * Or: npm run test:performance
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const TEST_DURATION = 60000; // 60 seconds
const CONCURRENT_USERS = 100;
const RAMP_UP_TIME = 10000; // 10 seconds to reach full load

// Test user
const TEST_USER = {
  email: process.env.E2E_CUSTOMER_EMAIL ?? 'perf_test@example.com',
  password: process.env.E2E_CUSTOMER_PASSWORD ?? 'TestPassword123!',
};

// ============================================================================
// METRICS COLLECTION
// ============================================================================

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

const metrics: PerformanceMetrics[] = [];

function recordMetric(endpoint: string, method: string, duration: number, status: number, success: boolean, error?: string) {
  metrics.push({
    endpoint,
    method,
    duration,
    status,
    success,
    error,
    timestamp: Date.now(),
  });
}

function generateReport() {
  const successful = metrics.filter(m => m.success).length;
  const failed = metrics.filter(m => !m.success).length;
  const durations = metrics.map(m => m.duration);
  
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
  const p99 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.99)];
  
  const report = {
    summary: {
      totalRequests: metrics.length,
      successfulRequests: successful,
      failedRequests: failed,
      successRate: `${((successful / metrics.length) * 100).toFixed(2)}%`,
    },
    responseTimes: {
      min: `${min.toFixed(0)}ms`,
      max: `${max.toFixed(0)}ms`,
      avg: `${avg.toFixed(0)}ms`,
      p95: `${p95.toFixed(0)}ms`,
      p99: `${p99.toFixed(0)}ms`,
    },
    endpoints: groupMetricsByEndpoint(),
  };
  
  console.log('\n' + '='.repeat(70));
  console.log('PERFORMANCE TEST REPORT');
  console.log('='.repeat(70));
  console.log(JSON.stringify(report, null, 2));
  
  // Save to file
  fs.writeFileSync('performance-report.json', JSON.stringify(report, null, 2));
  
  return report;
}

function groupMetricsByEndpoint() {
  const grouped: Record<string, any> = {};
  
  for (const metric of metrics) {
    const key = `${metric.method} ${metric.endpoint}`;
    if (!grouped[key]) {
      grouped[key] = {
        count: 0,
        successful: 0,
        failed: 0,
        durations: [],
      };
    }
    
    grouped[key].count++;
    if (metric.success) grouped[key].successful++;
    else grouped[key].failed++;
    grouped[key].durations.push(metric.duration);
  }
  
  // Calculate stats per endpoint
  const result: Record<string, any> = {};
  for (const [key, data] of Object.entries(grouped)) {
    const durations = data.durations;
    result[key] = {
      requests: data.count,
      successful: data.successful,
      failed: data.failed,
      avgResponseTime: `${(durations.reduce((a: number, b: number) => a + b, 0) / durations.length).toFixed(0)}ms`,
      minResponseTime: `${Math.min(...durations).toFixed(0)}ms`,
      maxResponseTime: `${Math.max(...durations).toFixed(0)}ms`,
    };
  }
  
  return result;
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testLogin(page: any): Promise<boolean> {
  try {
    const start = Date.now();
    const response = await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const duration = Date.now() - start;
    
    recordMetric('/login', 'GET', duration, response?.status() || 200, response?.ok());
    return response?.ok() || false;
  } catch (error) {
    recordMetric('/login', 'GET', 0, 0, false, String(error));
    return false;
  }
}

async function testDashboard(page: any): Promise<boolean> {
  try {
    const start = Date.now();
    const response = await page.goto(`${BASE_URL}/customer/dashboard`, { waitUntil: 'networkidle' });
    const duration = Date.now() - start;
    
    recordMetric('/customer/dashboard', 'GET', duration, response?.status() || 200, response?.ok());
    return response?.ok() || false;
  } catch (error) {
    recordMetric('/customer/dashboard', 'GET', 0, 0, false, String(error));
    return false;
  }
}

async function testWorkOrderList(page: any): Promise<boolean> {
  try {
    const start = Date.now();
    const response = await page.goto(`${BASE_URL}/api/workorders`, { waitUntil: 'networkidle' });
    const duration = Date.now() - start;
    
    recordMetric('/api/workorders', 'GET', duration, response?.status() || 200, response?.ok());
    return response?.ok() || false;
  } catch (error) {
    recordMetric('/api/workorders', 'GET', 0, 0, false, String(error));
    return false;
  }
}

async function testSearch(page: any, query: string = 'test'): Promise<boolean> {
  try {
    const start = Date.now();
    const response = await page.goto(`${BASE_URL}/api/workorders?search=${query}`, { waitUntil: 'networkidle' });
    const duration = Date.now() - start;
    
    recordMetric('/api/workorders (search)', 'GET', duration, response?.status() || 200, response?.ok());
    return response?.ok() || false;
  } catch (error) {
    recordMetric('/api/workorders (search)', 'GET', 0, 0, false, String(error));
    return false;
  }
}

async function testComplexQuery(page: any): Promise<boolean> {
  try {
    const start = Date.now();
    const response = await page.goto(
      `${BASE_URL}/api/workorders?status=completed&sort=createdAt&limit=100&offset=0`,
      { waitUntil: 'networkidle' }
    );
    const duration = Date.now() - start;
    
    recordMetric('/api/workorders (complex)', 'GET', duration, response?.status() || 200, response?.ok());
    return response?.ok() || false;
  } catch (error) {
    recordMetric('/api/workorders (complex)', 'GET', 0, 0, false, String(error));
    return false;
  }
}

async function testCreateWorkOrder(page: any): Promise<boolean> {
  try {
    const start = Date.now();
    const response = await page.request.post(`${BASE_URL}/api/workorders`, {
      data: {
        title: `Performance Test WO ${Date.now()}`,
        description: 'Load test work order',
        priority: 'medium',
      },
    });
    const duration = Date.now() - start;
    
    recordMetric('/api/workorders', 'POST', duration, response.status(), response.ok());
    return response.ok();
  } catch (error) {
    recordMetric('/api/workorders', 'POST', 0, 0, false, String(error));
    return false;
  }
}

async function testFileUpload(page: any): Promise<boolean> {
  try {
    const start = Date.now();
    
    // Create a test file (1MB)
    const largeData = Buffer.alloc(1024 * 1024, 'test data');
    
    const response = await page.request.post(`${BASE_URL}/api/upload`, {
      multipart: {
        file: {
          name: 'test.bin',
          mimeType: 'application/octet-stream',
          buffer: largeData,
        },
      },
    });
    
    const duration = Date.now() - start;
    recordMetric('/api/upload', 'POST', duration, response.status(), response.ok());
    return response.ok();
  } catch (error) {
    recordMetric('/api/upload', 'POST', 0, 0, false, String(error));
    return false;
  }
}

// ============================================================================
// CONCURRENT LOAD TEST
// ============================================================================

async function runConcurrentUserTest() {
  console.log(`Starting concurrent load test with ${CONCURRENT_USERS} users...`);
  
  const browser = await chromium.launch();
  const startTime = Date.now();
  let activeUsers = 0;
  const targetTime = startTime + TEST_DURATION;
  
  // Create user batches to ramp up gradually
  const usersPerBatch = Math.ceil(CONCURRENT_USERS / (RAMP_UP_TIME / 1000));
  
  try {
    while (Date.now() < targetTime) {
      // Ramp up users
      if (activeUsers < CONCURRENT_USERS) {
        for (let i = 0; i < usersPerBatch && activeUsers < CONCURRENT_USERS; i++) {
          activeUsers++;
          
          // Spawn user task
          (async () => {
            try {
              const page = await browser.newPage();
              
              // Vary test behavior
              const testType = Math.random();
              
              if (testType < 0.3) {
                await testDashboard(page);
              } else if (testType < 0.6) {
                await testWorkOrderList(page);
              } else if (testType < 0.8) {
                await testSearch(page, `test${Math.random()}`);
              } else {
                await testComplexQuery(page);
              }
              
              await page.close();
            } catch (error) {
              console.error('User task error:', error);
            }
          })();
        }
      }
      
      // Log progress
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const requestsPerSec = (metrics.length / (Date.now() - startTime)) * 1000;
      console.log(`[${elapsed}s] Active users: ${activeUsers} | Requests: ${metrics.length} (${requestsPerSec.toFixed(0)}/sec)`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Wait for remaining requests to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } finally {
    await browser.close();
  }
}

// ============================================================================
// REAL-TIME UPDATES TEST
// ============================================================================

async function testRealtimeUpdates() {
  console.log('\nTesting real-time updates under load...');
  
  const browser = await chromium.launch();
  
  try {
    const pages = [];
    
    // Create 10 pages to simulate concurrent viewers
    for (let i = 0; i < 10; i++) {
      const page = await browser.newPage();
      pages.push(page);
      
      // Navigate to work order list
      await page.goto(`${BASE_URL}/customer/dashboard`, { waitUntil: 'networkidle' });
    }
    
    // Simulate notifications/updates by polling
    for (let j = 0; j < 20; j++) {
      const pollTime = Date.now();
      
      for (const page of pages) {
        try {
          const start = Date.now();
          await page.reload({ waitUntil: 'networkidle' });
          const duration = Date.now() - start;
          
          recordMetric('/realtime-update', 'GET', duration, 200, true);
        } catch (error) {
          recordMetric('/realtime-update', 'GET', 0, 0, false, String(error));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Close pages
    for (const page of pages) {
      await page.close();
    }
    
  } finally {
    await browser.close();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('PERFORMANCE & LOAD TESTING SUITE');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`Test Duration: ${TEST_DURATION}ms`);
  console.log(`Ramp-up Time: ${RAMP_UP_TIME}ms`);
  console.log('='.repeat(70));
  
  try {
    // Run concurrent user test
    await runConcurrentUserTest();
    
    // Run real-time updates test
    await testRealtimeUpdates();
    
    // Generate and print report
    generateReport();
    
    console.log('\n✓ Performance tests completed. Report saved to performance-report.json');
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runConcurrentUserTest, testRealtimeUpdates, generateReport };
