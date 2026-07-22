# Phase 5: Comprehensive Testing Guide

**Status**: 🟢 READY FOR EXECUTION  
**Created**: 2026-07-22  
**Duration**: Week 9-10  
**Output**: Production-Ready Quality Verification

---

## 📋 Overview

Phase 5 comprehensive testing validates all system functionality, security, performance, and mobile compatibility before production deployment. This guide covers execution of 200+ test cases across 4 test suites.

### Test Coverage
- ✅ **50+ E2E Workflow Tests** - All user roles and full workflows
- ✅ **35+ Security Tests** - Authentication, authorization, injection prevention, CSRF
- ✅ **Performance Tests** - 100 concurrent users, real-time updates, file uploads
- ✅ **40+ Mobile Tests** - Responsive, offline, GPS, camera, push notifications

### Expected Results
- **Success Rate Target**: ≥95% (allow for environment-specific failures)
- **Performance Target**: Page loads <3s, API responses <500ms, p95 <1.5s
- **Security**: All 26+ security fixes verified, 0 vulnerabilities in OWASP Top 10

---

## 🚀 Setup & Prerequisites

### 1. Environment Configuration

```bash
# Create .env.local with test credentials
E2E_CUSTOMER_EMAIL=customer@example.com
E2E_CUSTOMER_PASSWORD=TestPassword123!
E2E_TECH_EMAIL=tech@example.com
E2E_TECH_PASSWORD=TestPassword123!
E2E_MANAGER_EMAIL=manager@example.com
E2E_MANAGER_PASSWORD=TestPassword123!
E2E_SHOP_EMAIL=shop@example.com
E2E_SHOP_PASSWORD=TestPassword123!
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=TestPassword123!
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### 2. Database Setup

```bash
# Ensure database is clean and seeded with test data
npx prisma db push
npx prisma db seed  # If seed file exists

# Or manually create test data:
# - 5 test customers
# - 3 test techs
# - 2 test managers  
# - 2 test shops
# - 1 admin account
# - Multiple work orders in various statuses
```

### 3. Start Development Server

```bash
# Terminal 1: Start Next.js server
npm run dev

# Wait for: "✓ Ready in 1234ms"
# Should be accessible at: http://localhost:3000
```

### 4. Install Dependencies

```bash
# Ensure all test dependencies are installed
npm install --save-dev @playwright/test ts-node

# Playwright browsers
npx playwright install
```

---

## 📊 Test Suite Execution

### Suite 1: E2E Workflow Tests (50+ scenarios)

**File**: `e2e/workflows.spec.ts`

#### Run All Workflow Tests
```bash
npm run test:e2e -- workflows.spec.ts

# Or specific test
npm run test:e2e -- workflows.spec.ts -g "Customer Workflow"
```

#### Test Groups

**5.1.1 Customer Workflow: Book → Pay → Review** (5 tests)
- [x] Customer views available services
- [x] Customer creates work order (books service)
- [x] Customer receives invoice and pays
- [x] Customer leaves review after completion
- [x] Customer tracks status in real-time

**Expected Results**:
- ✅ Work order created with correct status
- ✅ Payment processed via Stripe
- ✅ Review saved to database
- ✅ Status updates visible in real-time

**5.1.2 Technician Workflow: View → Accept → Complete** (6 tests)
- [x] Tech views assigned work orders
- [x] Tech accepts work order
- [x] Tech starts break tracking
- [x] Tech shares GPS location
- [x] Tech completes work with photos & notes
- [x] Tech uploads completion photos

**Expected Results**:
- ✅ Work orders visible in tech dashboard
- ✅ Status changes to "In Progress"
- ✅ Break time deducted from payroll
- ✅ Location updates received by manager
- ✅ Work order marked complete
- ✅ Photos attached and visible

**5.1.3 Manager Workflow: Assign → Monitor → Approve** (5 tests)
- [x] Manager views team dashboard
- [x] Manager assigns work order to tech
- [x] Manager monitors progress in real-time
- [x] Manager approves completed work orders
- [x] Manager views team analytics

**Expected Results**:
- ✅ Work orders assigned successfully
- ✅ Real-time progress visible
- ✅ Approval changes status and triggers payment
- ✅ Analytics show team metrics

**5.1.4 Shop Owner Workflow: Create → Monitor → Payouts** (5 tests)
- [x] Shop owner views dashboard
- [x] Shop owner manages team members
- [x] Shop owner sets hourly rates & payroll
- [x] Shop owner views revenue & payouts
- [x] Shop owner configures shop settings

**Expected Results**:
- ✅ Dashboard shows revenue, pending jobs, team status
- ✅ Team members can be created/edited
- ✅ Hourly rates saved and used in calculations
- ✅ Payouts calculated correctly
- ✅ Settings persist across sessions

**5.1.5 Admin Workflow: System Management** (4 tests)
- [x] Admin views system dashboard
- [x] Admin manages users and roles
- [x] Admin manages shops
- [x] Admin views audit logs

**Expected Results**:
- ✅ System metrics visible
- ✅ Users can be created/deleted
- ✅ Shops can be activated/deactivated
- ✅ All actions logged in audit trail

**5.1.6 Integration: Phase 4 Features** (3 tests)
- [x] Payment refunds work end-to-end
- [x] Push notifications delivered
- [x] DVI inspection workflow completes

**Expected Results**:
- ✅ Refund processed within 90 days
- ✅ Notifications appear in browser
- ✅ DVI email sent to customer

---

### Suite 2: Security Audit Tests (35+ scenarios)

**File**: `e2e/security.spec.ts`

#### Run All Security Tests
```bash
npm run test:e2e -- security.spec.ts

# Or by category
npm run test:e2e -- security.spec.ts -g "Authentication"
npm run test:e2e -- security.spec.ts -g "RBAC"
npm run test:e2e -- security.spec.ts -g "Rate Limiting"
npm run test:e2e -- security.spec.ts -g "Data Leak"
npm run test:e2e -- security.spec.ts -g "Injection"
npm run test:e2e -- security.spec.ts -g "CSRF"
npm run test:e2e -- security.spec.ts -g "Headers"
```

#### Test Categories & Expected Results

**5.2.1 Authentication & 2FA** (5 tests)
- ✅ Invalid credentials rejected with generic error
- ✅ Password strength enforced (min 8 chars, mixed case, number)
- ✅ Session expires after inactivity
- ✅ 2FA prompt appears for admin accounts
- ✅ Cannot proceed without valid 2FA code

**5.2.2 Authorization & RBAC** (4 tests)
- ✅ Unauthenticated users redirected to login
- ✅ Customers cannot access admin pages
- ✅ URL parameter manipulation (`?role=admin`) ignored
- ✅ Users cannot access other users' data

**5.2.3 Rate Limiting & Brute Force** (2 tests)
- ✅ Login attempts limited (after 10 failed attempts, blocked)
- ✅ API endpoints return 429 (Too Many Requests) under load

**5.2.4 Data Leak Prevention** (3 tests)
- ✅ Error messages are generic (no SQL, database info)
- ✅ HTTP headers don't expose server info
- ✅ Passwords not stored in page HTML

**5.2.5 Injection & XSS Prevention** (3 tests)
- ✅ SQL injection in search fields handled safely
- ✅ JavaScript in comments/notes doesn't execute
- ✅ Command injection in file uploads blocked

**5.2.6 CSRF Protection** (1 test)
- ✅ POST requests without CSRF token rejected or require Bearer token

**5.2.7 Security Headers** (3 tests)
- ✅ `X-Frame-Options: DENY` prevents clickjacking
- ✅ `X-Content-Type-Options: nosniff` prevents MIME sniffing
- ✅ `Strict-Transport-Security` set for HTTPS

---

### Suite 3: Performance & Load Testing

**File**: `performance-test.ts`

#### Run Performance Tests
```bash
# Run concurrent user load test
npx ts-node performance-test.ts

# Or via npm script (if configured)
npm run test:performance
```

#### Test Scenarios

**5.3.1 Concurrent User Load (100 users)**

```bash
npm run test:performance
# Output: performance-report.json
```

**Expected Results**:
```json
{
  "summary": {
    "totalRequests": 1000,
    "successfulRequests": 950,
    "failedRequests": 50,
    "successRate": "95%"
  },
  "responseTimes": {
    "avg": "450ms",
    "p95": "1200ms",
    "p99": "2100ms"
  }
}
```

**Pass Criteria**:
- ✅ ≥95% requests succeed
- ✅ Average response <500ms
- ✅ p95 response <1.5s
- ✅ p99 response <3s
- ✅ No cascading failures

**5.3.2 Real-Time Updates Under Load**
- ✅ 10 concurrent browsers polling for updates
- ✅ Refresh completes in <1 second
- ✅ No data corruption during concurrent updates
- ✅ Notifications delivered to all users

**5.3.3 Large File Uploads**
- ✅ 1MB file upload completes in <5 seconds
- ✅ 10MB file upload completes in <30 seconds
- ✅ Progress tracking accurate
- ✅ Server handles multiple concurrent uploads

**5.3.4 Complex Query Performance**
- ✅ Filter by multiple criteria completes in <500ms
- ✅ Sorting 1000 items completes in <300ms
- ✅ Pagination works correctly
- ✅ Search completes in <200ms

---

### Suite 4: Mobile & Responsive Testing (40+ tests)

**File**: `e2e/mobile.spec.ts`

#### Run Mobile Tests
```bash
npm run test:e2e -- mobile.spec.ts

# Or by category
npm run test:e2e -- mobile.spec.ts -g "Responsive"
npm run test:e2e -- mobile.spec.ts -g "Offline"
npm run test:e2e -- mobile.spec.ts -g "Camera"
npm run test:e2e -- mobile.spec.ts -g "Push"
npm run test:e2e -- mobile.spec.ts -g "Performance"
```

#### Test Categories

**5.4.1 Responsive Web Design** (5 tests)
- ✅ iPhone layout (390×844) adapts correctly
- ✅ Tablet layout (1024×768) works well
- ✅ Buttons are ≥44×44px for touch
- ✅ Navigation accessible on mobile
- ✅ Images scale properly

**5.4.2 Offline Mode** (3 tests)
- ✅ Content cached for offline viewing
- ✅ User actions queued while offline
- ✅ Data syncs when back online

**5.4.3 GPS & Location** (3 tests)
- ✅ Location permission requested
- ✅ Tech location shared with manager
- ✅ Map displays tech location

**5.4.4 Camera Integration** (2 tests)
- ✅ Camera permission requested
- ✅ Photos uploadable from camera roll

**5.4.5 Push Notifications** (3 tests)
- ✅ App registers for notifications
- ✅ Notifications received and displayed
- ✅ Notification actions work (tap to view)

**5.4.6 Mobile Performance** (2 tests)
- ✅ Page loads in <5 seconds
- ✅ Scrolling maintains ≥30 FPS

**5.4.7 Touch Gestures** (2 tests)
- ✅ Swipe navigation works
- ✅ Long press shows options

---

## ✅ Testing Checklist

### Pre-Testing
- [ ] Database seeded with test data (5 customers, 3 techs, etc.)
- [ ] Dev server running on http://localhost:3000
- [ ] Test credentials configured in .env.local
- [ ] Playwright browsers installed (`npx playwright install`)
- [ ] All dependencies installed (`npm install`)

### Execution
- [ ] Run workflow tests: `npm run test:e2e -- workflows.spec.ts`
  - [ ] Customer workflow: 5/5 pass
  - [ ] Tech workflow: 6/6 pass
  - [ ] Manager workflow: 5/5 pass
  - [ ] Shop owner workflow: 5/5 pass
  - [ ] Admin workflow: 4/4 pass
  - [ ] Integration tests: 3/3 pass
  
- [ ] Run security tests: `npm run test:e2e -- security.spec.ts`
  - [ ] Authentication: 5/5 pass
  - [ ] Authorization: 4/4 pass
  - [ ] Rate limiting: 2/2 pass
  - [ ] Data leak prevention: 3/3 pass
  - [ ] Injection prevention: 3/3 pass
  - [ ] CSRF protection: 1/1 pass
  - [ ] Security headers: 3/3 pass

- [ ] Run performance tests: `npx ts-node performance-test.ts`
  - [ ] 100 concurrent users: ≥95% success
  - [ ] Average response <500ms
  - [ ] p95 <1.5s, p99 <3s

- [ ] Run mobile tests: `npm run test:e2e -- mobile.spec.ts`
  - [ ] Responsive design: 5/5 pass
  - [ ] Offline mode: 3/3 pass
  - [ ] GPS & location: 3/3 pass
  - [ ] Camera: 2/2 pass
  - [ ] Push notifications: 3/3 pass
  - [ ] Performance: 2/2 pass
  - [ ] Touch gestures: 2/2 pass

### Post-Testing
- [ ] Generate test report: `npm run test:all`
- [ ] Review failures and document issues
- [ ] Fix critical bugs (blockers for production)
- [ ] Defer non-critical issues to v0.0.5
- [ ] Update session memory with results
- [ ] Proceed to Phase 6 if ≥95% pass rate

---

## 🐛 Common Issues & Troubleshooting

### Issue: Tests timeout connecting to server
**Solution**: Ensure dev server is running
```bash
npm run dev
# Or check PORT=3000
```

### Issue: Test database doesn't have test data
**Solution**: Seed database
```bash
npx prisma db push
npx prisma db seed
```

### Issue: Playwright browsers not installed
**Solution**:
```bash
npx playwright install
npx playwright install-deps
```

### Issue: Port 3000 already in use
**Solution**:
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
```

### Issue: CORS errors in API tests
**Solution**: Ensure API allows requests from `http://localhost:3000`
- Check `next.config.ts` for CORS headers
- Verify test runs on same origin

### Issue: 2FA test fails
**Solution**: Disable 2FA for test admin account
```bash
# Or mock 2FA codes in test
```

---

## 📈 Performance Targets

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Page Load (Desktop) | <2s | <3s |
| Page Load (Mobile) | <3s | <5s |
| API Response (avg) | <300ms | <500ms |
| API Response (p95) | <800ms | <1.5s |
| Concurrent Users | 100+ | 50+ |
| Error Rate | <1% | <5% |
| Security Vulnerabilities | 0 | 0 |

---

## 🔐 Security Checklist

- [ ] All 2FA fixes verified
- [ ] Rate limiting working (login, API)
- [ ] RBAC prevents unauthorized access
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] CSRF tokens validated
- [ ] Security headers present
- [ ] No sensitive data in errors
- [ ] Sessions expire properly
- [ ] Password strength enforced
- [ ] Audit logs capture all actions
- [ ] Data encryption in transit (HTTPS)

---

## 📝 Test Results Template

```
# Phase 5 Testing Results - [Date]

## Summary
- Total Tests: 200+
- Passed: ___
- Failed: ___
- Skipped: ___
- Success Rate: ___%

## Workflow Tests (50+)
- Customer: __/5 ✅/❌
- Tech: __/6 ✅/❌
- Manager: __/5 ✅/❌
- Shop Owner: __/5 ✅/❌
- Admin: __/4 ✅/❌
- Integration: __/3 ✅/❌

## Security Tests (35+)
- Authentication: __/5 ✅/❌
- Authorization: __/4 ✅/❌
- Rate Limiting: __/2 ✅/❌
- Data Leak Prevention: __/3 ✅/❌
- Injection Prevention: __/3 ✅/❌
- CSRF: __/1 ✅/❌
- Headers: __/3 ✅/❌

## Performance
- Concurrent Users: 100 ✅/❌
- Success Rate: __% (Target: ≥95%)
- Avg Response: ___ms (Target: <500ms)
- p95: ___ms (Target: <1.5s)
- p99: ___ms (Target: <3s)

## Mobile (40+)
- Responsive: __/5 ✅/❌
- Offline: __/3 ✅/❌
- GPS: __/3 ✅/❌
- Camera: __/2 ✅/❌
- Push: __/3 ✅/❌
- Performance: __/2 ✅/❌
- Gestures: __/2 ✅/❌

## Critical Issues
- [ ] None
- [ ] (List any)

## Recommendations
- Proceed to Phase 6 (Deployment)
- Fix issues, then retest
- Other: _______________
```

---

## Next Steps (Phase 6)

Upon completion with ≥95% pass rate:

1. **Production Deployment**
   - Deploy to staging
   - Run smoke tests
   - Deploy to production
   
2. **Monitoring Setup**
   - Configure Sentry/error tracking
   - Set up performance monitoring
   - Enable audit logging
   
3. **Go-Live**
   - Monitor 24/7
   - Document any issues
   - Schedule postmortem

---

## 📚 References

- Playwright docs: https://playwright.dev
- Jest docs: https://jestjs.io
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Performance budgets: https://web.dev/performance-budgets/
- Accessibility: https://www.w3.org/WAI/WCAG21/quickref/

---

**Status**: ✅ Phase 5 Testing Guide Complete  
**Last Updated**: 2026-07-22
