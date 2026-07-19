# Clock-In Systems Implementation Guide

## For Developers: How to Use Both Systems

### Quick Start

#### 1. Timesheet Clock-In (Existing)
Already implemented and in use. Uses `/api/time-tracking` endpoints.

```javascript
// Frontend: Clock in at start of shift
const response = await fetch('/api/time-tracking', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    action: 'clock-in',
    techId: userID,
    shopId: shopID,
    location: gpsLocation // optional
  })
});
```

#### 2. Work Order Clock-In (New)
Now available for job-level tracking. Uses `/api/workorders/[id]/time-tracking` endpoints.

```javascript
// Frontend: Clock in on a specific job
const response = await fetch(`/api/workorders/${workOrderId}/time-tracking`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    action: 'clock-in',
    techId: userID,
    notes: 'Starting diagnostics' // optional
  })
});
```

---

## Data Models

### TimeEntry (Timesheet Clock-In)
- **Table**: `time_entries`
- **Purpose**: Hourly wage tracking for payroll
- **Key Fields**:
  - `clockIn`: When tech started shift
  - `clockOut`: When tech ended shift
  - `hoursWorked`: Total hours (for pay calculation)
  - `workOrderId`: *Optional* link to a job (for reporting, not payroll)
  - `approved`: Locked for payroll once approved
  - `locked`: Cannot be edited after lock

### WorkOrderTimeEntry (Job Clock-In)
- **Table**: `work_order_time_entries`
- **Purpose**: Job-level time tracking and performance analytics
- **Key Fields**:
  - `workOrderId`: Which job this time is for
  - `clockIn`: When work started
  - `clockOut`: When work ended
  - `hoursSpent`: Time on this specific job
  - `status`: 'active' | 'paused' | 'completed'
  - `notes`: Context (e.g., "waiting for part", "customer unavailable")

---

## Frontend Component Usage

### Embedding Job Clock-In on Work Order Page

```tsx
'use client';
import { WorkOrderTimeClock } from '@/components/WorkOrderTimeClock';

export default function WorkOrderDetailPage() {
  const [workOrder, setWorkOrder] = useState();
  const [user, setUser] = useState();

  return (
    <div>
      {/* Work order info */}
      <h1>{workOrder.issueDescription}</h1>

      {/* Job clock-in component - add this! */}
      <WorkOrderTimeClock
        workOrderId={workOrder.id}
        techId={user.id}
        techName={`${user.firstName} ${user.lastName}`}
        onEntryCreated={() => {
          // Callback when a time entry is created
          // Can refresh analytics, etc.
        }}
      />

      {/* Rest of work order details */}
    </div>
  );
}
```

### WorkOrderTimeClock Props

```typescript
interface WorkOrderTimeClockProps {
  workOrderId: string;        // Work order ID
  techId: string;             // Tech clocking in
  techName: string;           // Display name
  onEntryCreated?: () => void; // Callback after clock-in/out
}
```

---

## API Reference

### Timesheet Clock-In API

**Endpoint**: `POST /api/time-tracking`

**Request**:
```json
{
  "action": "clock-in" | "clock-out" | "break-start" | "break-end",
  "techId": "string",
  "shopId": "string",
  "notes": "string (optional)",
  "location": { "lat": number, "lon": number } // optional
}
```

**Response** (clock-in):
```json
{
  "success": true,
  "message": "Clocked in successfully",
  "timeEntry": {
    "id": "entry123",
    "techId": "tech123",
    "clockIn": "2024-01-15T09:00:00Z",
    "clockOut": null
  }
}
```

### Work Order Clock-In API

**Endpoint**: `POST /api/workorders/{id}/time-tracking`

**Request**:
```json
{
  "action": "clock-in" | "clock-out" | "pause" | "resume",
  "techId": "string",
  "notes": "string (optional)"
}
```

**Response** (clock-in):
```json
{
  "success": true,
  "message": "Clocked in to work order",
  "entry": {
    "id": "joEntry123",
    "workOrderId": "wo123",
    "techId": "tech123",
    "clockIn": "2024-01-15T09:00:00Z",
    "hoursSpent": null,
    "status": "active"
  }
}
```

**Get time entries for a job**:
```bash
GET /api/workorders/{id}/time-tracking
```

---

## Common Workflows

### Workflow 1: Daily Clock-In/Out (No Job Tracking)

```javascript
// Morning: Clock in for shift
POST /api/time-tracking
{
  "action": "clock-in",
  "techId": "tech123",
  "shopId": "shop456"
}
// Creates TimeEntry

// ... work on various tasks ...

// Evening: Clock out
POST /api/time-tracking
{
  "action": "clock-out",
  "techId": "tech123",
  "shopId": "shop456"
}
// Updates TimeEntry with clockOut and hoursWorked
```

### Workflow 2: Clock In + Job Tracking (New)

```javascript
// Morning: Clock in for shift (timesheet)
POST /api/time-tracking
{
  "action": "clock-in",
  "techId": "tech123",
  "shopId": "shop456"
}
// Creates TimeEntry (for payroll)

// 9:15 AM: Start work on Job A (job tracking)
POST /api/workorders/wo123/time-tracking
{
  "action": "clock-in",
  "techId": "tech123",
  "notes": "Diagnosing transmission issue"
}
// Creates WorkOrderTimeEntry for Job A

// 10:30 AM: Pause work (waiting for parts)
POST /api/workorders/wo123/time-tracking
{
  "action": "pause",
  "techId": "tech123"
}
// Updates WorkOrderTimeEntry status to 'paused'

// 11:00 AM: Resume work
POST /api/workorders/wo123/time-tracking
{
  "action": "resume",
  "techId": "tech123"
}
// Updates WorkOrderTimeEntry status back to 'active'

// 12:00 PM: Complete job, clock out
POST /api/workorders/wo123/time-tracking
{
  "action": "clock-out",
  "techId": "tech123"
}
// Calculates hoursSpent and sets status to 'completed'

// Evening: Clock out of shift
POST /api/time-tracking
{
  "action": "clock-out",
  "techId": "tech123",
  "shopId": "shop456"
}
// Updates TimeEntry with final hours

// Result:
// - TimeEntry: 7 hours (for payroll)
// - WorkOrderTimeEntry: 2.75 hours on Job A (for analytics)
```

### Workflow 3: Multiple Techs on Same Job

```javascript
// Tech 1 clocks in to Job A
POST /api/workorders/jobA/time-tracking
{
  "action": "clock-in",
  "techId": "tech1"
}

// Tech 2 clocks in to Job A (same job)
POST /api/workorders/jobA/time-tracking
{
  "action": "clock-in",
  "techId": "tech2"
}

// When job is done:
GET /api/workorders/jobA/time-tracking

Response: {
  "timeEntries": [
    { "techId": "tech1", "hoursSpent": 3.5, "tech": { "firstName": "John" } },
    { "techId": "tech2", "hoursSpent": 3.5, "tech": { "firstName": "Sarah" } }
  ],
  "totals": {
    "totalHoursSpent": 7,
    "entriesCount": 2
  }
}

// Can now calculate blended labor cost:
// Labor Cost = (3.5 * john_rate) + (3.5 * sarah_rate)
```

---

## Querying Data

### Get a Tech's Timesheet for a Pay Period

```javascript
const startDate = new Date(2024, 0, 1); // Jan 1, 2024
const endDate = new Date(2024, 0, 7);   // Jan 7, 2024

const entries = await prisma.timeEntry.findMany({
  where: {
    techId: 'tech123',
    clockIn: {
      gte: startDate,
      lte: endDate
    },
    approved: true // Only approved for payroll
  },
  orderBy: { clockIn: 'asc' }
});

// Calculate payroll
const totalHours = entries.reduce((sum, e) => sum + e.hoursWorked, 0);
const grossPay = totalHours * tech.hourlyRate;
```

### Get Job Time Entries for Profitability Analysis

```javascript
const jobEntries = await prisma.workOrderTimeEntry.findMany({
  where: {
    workOrderId: 'wo123'
  },
  include: {
    tech: { select: { firstName: true, lastName: true, hourlyRate: true } }
  }
});

// Calculate labor cost
const laborCost = jobEntries
  .filter(e => e.hoursSpent)
  .reduce((sum, e) => sum + (e.hoursSpent * e.tech.hourlyRate), 0);

// Profit calculation
const workOrder = await prisma.workOrder.findUnique({
  where: { id: 'wo123' }
});

const jobProfit = workOrder.estimatedCost - laborCost;
const profitMargin = (jobProfit / workOrder.estimatedCost) * 100;

console.log(`Job Profit: $${jobProfit.toFixed(2)} (${profitMargin.toFixed(1)}% margin)`);
```

### Get Tech Performance Metrics

```javascript
// Tech turn-over rate for a period
const workOrderEntries = await prisma.workOrderTimeEntry.groupBy({
  by: ['techId'],
  where: {
    clockIn: {
      gte: new Date('2024-01-01'),
      lte: new Date('2024-01-31')
    },
    status: 'completed'
  },
  _sum: {
    hoursSpent: true
  },
  _count: true
});

// workOrderEntries result:
// [
//   { techId: 'tech1', _sum: { hoursSpent: 40 }, _count: 5 }  // 5 jobs in 40h = 0.125 jobs/hour
//   { techId: 'tech2', _sum: { hoursSpent: 35 }, _count: 6 }  // 6 jobs in 35h = 0.17 jobs/hour (faster!)
// ]
```

---

## Best Practices

### DO ✅
- Use `TimeEntry` for payroll calculations
- Use `WorkOrderTimeEntry` for job analytics
- Run both systems in parallel for full visibility
- Include optional `notes` in work order time entries for context
- Pause job timing when tech isn't actively working on it
- Approve timesheet entries before generating pay stubs

### DON'T ❌
- Use `WorkOrderTimeEntry` for payroll calculations
- Combine both systems' hours for pay (they track different scopes)
- Assume `TimeEntry.workOrderId` is always populated
- Lock job time entries (they should remain editable)
- Use GPS location in `WorkOrderTimeEntry` (that's for `TimeEntry`)

---

## Debugging

### Issue: Tech clocked in but no TimeEntry created

**Check**:
```javascript
const entry = await prisma.timeEntry.findFirst({
  where: { techId: 'tech123', clockOut: null }
});
console.log('Active entry:', entry);
```

**Possible causes**:
- Authorization failed (check auth token)
- Missing `techId` or `shopId` in request
- Tech already has active entry (error returned)

### Issue: WorkOrderTimeEntry created but not visible in UI

**Check**:
```javascript
const entries = await prisma.workOrderTimeEntry.findMany({
  where: { workOrderId: 'wo123' }
});
console.log('Total entries:', entries.length);
```

**Possible causes**:
- Entry status is 'paused' (should still be visible)
- Frontend not refreshing after POST
- Wrong workOrderId in query

### Issue: hoursSpent is null after clock-out

**Check**:
```javascript
const entry = await prisma.workOrderTimeEntry.findUnique({
  where: { id: 'entry123' }
});
console.log('Entry:', entry);
// hoursSpent should be calculated on clock-out
```

**Possible causes**:
- hoursSpent not saved on clock-out (check API endpoint)
- Frontend not awaiting response before refreshing

---

## Deployment Checklist

- [ ] Run Prisma migration: `npx prisma migrate deploy`
- [ ] Test TimeEntry (existing) still works
- [ ] Test WorkOrderTimeEntry creation via API
- [ ] Embed WorkOrderTimeClock component on work order pages
- [ ] Update work order page styling to accommodate new component
- [ ] Test clock-in/out flows in dev environment
- [ ] Test with multiple techs on same job
- [ ] Verify authorization checks work correctly
- [ ] Document for tech users and shop managers
- [ ] Monitor for any breaking changes in existing flows

---

## Future Development

### Phase 2: Analytics Dashboard
- Job time vs. estimated time
- Tech performance rankings
- Job profitability by category
- Turn-over rate trends

### Phase 3: Automation
- Auto-populate labor hours on job completion
- Suggest labor rates based on historical data
- Flag jobs that exceed estimated time

### Phase 4: Integration
- Export job time data to accounting software
- Sync with project management tools
- Mobile app support for job clock-in

---

## Questions?

Refer to [CLOCK_IN_SYSTEMS.md](./CLOCK_IN_SYSTEMS.md) for the full system documentation.
