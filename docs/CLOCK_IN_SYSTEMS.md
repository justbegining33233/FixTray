# Clock-In Systems Documentation

## Overview

FixTray has **TWO SEPARATE clock-in systems** to handle different business needs:

1. **Timesheet Clock-In** - For hourly wage/payroll tracking
2. **Work Order Clock-In** - For job-level time tracking and performance metrics

Understanding the distinction is critical for proper data tracking and payroll accuracy.

---

## System 1: Timesheet Clock-In (Hourly Wage Tracking)

### Purpose
Track employee hours worked during a pay period for payroll and compensation calculation.

### Key Characteristics
- **Scope**: Shop-wide (tech clocks in/out at the start/end of their shift)
- **Frequency**: Once per shift (one TimeEntry per shift)
- **Primary Use**: Payroll calculation, hourly wage determination
- **Data Model**: `TimeEntry`

### Database Model
```prisma
model TimeEntry {
  id            String     @id @default(cuid())
  techId        String
  shopId        String
  clockIn       DateTime
  clockOut      DateTime?
  breakStart    DateTime?
  breakEnd      DateTime?
  breakDuration Float?
  breaks        Json?
  workOrderId   String?          // OPTIONAL - can link to a job
  isPto         Boolean    @default(false)
  approved      Boolean    @default(false)  // For payroll approval
  approvedBy    String?
  approvedAt    DateTime?
  locked        Boolean    @default(false)  // Locks entry from further edits
  hoursWorked   Float?           // Total hours (includes breaks)
  notes         String?
  location      String?          // GPS location
  clockInPhoto  String?
  clockOutPhoto String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  tech          Tech       @relation(fields: [techId], references: [id], onDelete: Cascade)
  workOrder     WorkOrder? @relation(fields: [workOrderId], references: [id])

  @@index([techId])
  @@index([shopId])
  @@index([clockIn])
  @@index([workOrderId])
  @@map("time_entries")
}
```

### API Endpoints

**GET** `/api/time-tracking` - Retrieve timesheet entries for a tech in a date range
```json
{
  "techId": "tech123",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-07T23:59:59Z"
}
```

**POST** `/api/time-tracking` - Clock in/out, start/end break
```json
{
  "action": "clock-in" | "clock-out" | "break-start" | "break-end",
  "techId": "tech123",
  "shopId": "shop456",
  "notes": "optional",
  "location": { "lat": 40.7128, "lon": -74.0060 }
}
```

### Frontend Components
- `TimeClock.tsx` - Main clock in/out interface for techs
- `TechTimesheet` page (`/tech/timesheet`) - View hours and billable time
- `ShopTimeClockPage` (`/shop/timeclock`) - Shop manager view of all employee hours

### Payroll Workflow
1. Tech clocks in at start of shift → creates TimeEntry
2. Tech may work on one or more work orders during shift
3. Tech clocks out at end of shift → TimeEntry.clockOut set
4. Shop manager reviews and approves hours
5. PayStub generated based on approved TimeEntries

---

## System 2: Work Order Clock-In (Job Tracking)

### Purpose
Track the actual time technicians spend on **specific jobs** to:
- Calculate job profitability
- Measure tech turn-over rate (jobs completed per hour)
- Track which tech performed which work
- Identify bottlenecks and efficiency issues
- Support job costing

### Key Characteristics
- **Scope**: Job-specific (multiple entries per work order)
- **Frequency**: Can have multiple clock-in/out pairs per job (e.g., tech works on job, pauses for break/other tasks, resumes)
- **Primary Use**: Job analytics, performance metrics, profitability analysis
- **Data Model**: `WorkOrderTimeEntry` (NEW)
- **Independent**: Does NOT affect payroll calculations

### Database Model
```prisma
model WorkOrderTimeEntry {
  id              String    @id @default(cuid())
  workOrderId     String
  techId          String
  shopId          String
  clockIn         DateTime
  clockOut        DateTime?
  hoursSpent      Float?           // Calculated when clocked out
  notes           String?          // e.g., "Replaced alternator", "Awaiting parts"
  status          String    @default("active") // active | paused | completed
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  workOrder       WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  tech            Tech      @relation("workOrderTimeEntries", fields: [techId], references: [id], onDelete: Cascade)

  @@index([workOrderId])
  @@index([techId])
  @@index([shopId])
  @@index([clockIn])
  @@map("work_order_time_entries")
}
```

### API Endpoints

**GET** `/api/workorders/{id}/time-tracking` - Get all time entries for a work order
```json
Response:
{
  "success": true,
  "workOrderId": "wo123",
  "timeEntries": [
    {
      "id": "entry1",
      "workOrderId": "wo123",
      "techId": "tech123",
      "clockIn": "2024-01-15T09:00:00Z",
      "clockOut": "2024-01-15T11:30:00Z",
      "hoursSpent": 2.5,
      "status": "completed",
      "notes": "Replaced alternator",
      "tech": { "id": "tech123", "firstName": "John", "lastName": "Doe" }
    }
  ],
  "totals": {
    "totalHoursSpent": 7.5,
    "entriesCount": 3,
    "activeEntriesCount": 0
  }
}
```

**POST** `/api/workorders/{id}/time-tracking` - Clock in/out on a specific job
```json
{
  "action": "clock-in" | "clock-out" | "pause" | "resume",
  "techId": "tech123",
  "notes": "optional"
}
```

### Frontend Component
- `WorkOrderTimeClock.tsx` - Job-level clock in/out widget
  - Displays elapsed time on current job
  - Shows job time history
  - Pause/resume functionality for interruptions
  - Optional notes for context (e.g., "Waiting for customer", "Ordered part")

### Job Tracking Workflow
1. Tech starts work on job → clocks in to job via WorkOrderTimeClock
2. Tech pauses if they need to step away → status = 'paused'
3. Tech resumes → status = 'active' again
4. Tech completes job → clocks out → hoursSpent calculated
5. Data used for:
   - Job profitability report
   - Tech performance analytics
   - Turn-over rate calculation (e.g., jobs per hour)

---

## Key Differences Summary

| Aspect | Timesheet Clock-In | Work Order Clock-In |
|--------|-------------------|---------------------|
| **Model** | `TimeEntry` | `WorkOrderTimeEntry` |
| **Scope** | Shop-wide, pay period | Job-specific |
| **Frequency** | 1-2 per shift | 0-N per work order |
| **Primary Purpose** | Payroll | Job analytics |
| **Approval Required** | Yes (for payroll) | No (informational) |
| **Affects Pay** | Yes | No |
| **Lock/Audit** | Yes (frozen after approval) | No (always editable) |
| **GPS Tracking** | Yes (optional) | No (stored with work order) |
| **Break Tracking** | Yes | No (use pause/resume) |
| **Relation** | ShiftEntry → Tech → Shop | Job → Tech, stored on job |

---

## Implementation Details

### Creating a Time Entry (Timesheet)
```javascript
const entry = await prisma.timeEntry.create({
  data: {
    techId: "tech123",
    shopId: "shop456",
    clockIn: new Date(),
    location: { lat: 40.7128, lon: -74.0060 }
  }
});
```

### Creating a Job Time Entry
```javascript
const jobEntry = await prisma.workOrderTimeEntry.create({
  data: {
    workOrderId: "wo123",
    techId: "tech123",
    shopId: "shop456",
    clockIn: new Date(),
    notes: "Starting diagnostics"
  }
});
```

### Clocking Out of a Job
```javascript
const clockOutTime = new Date();
const hoursSpent = (clockOutTime - entry.clockIn) / (1000 * 60 * 60);

const updated = await prisma.workOrderTimeEntry.update({
  where: { id: entry.id },
  data: {
    clockOut: clockOutTime,
    hoursSpent: parseFloat(hoursSpent.toFixed(2)),
    status: "completed"
  }
});
```

---

## Common Scenarios

### Scenario 1: Tech Works a 8-Hour Shift
- **9:00 AM** - Tech clocks in (Timesheet)
  - Creates 1 `TimeEntry` with `clockIn: 09:00`
- **9:15 AM** - Starts work on Job A
  - Creates 1st `WorkOrderTimeEntry` for Job A
- **11:00 AM** - Pauses Job A to wait for part
  - Updates status to "paused", but doesn't clock out
- **11:30 AM** - Part arrives, resumes Job A
  - Updates status back to "active"
- **12:00 PM** - Completes Job A, clocks out
  - Clocks out of Job A: 2.75 hours spent
- **1:00 PM** - Lunch break (unpaid, not clocked in)
- **2:00 PM** - Starts work on Job B
  - Creates 2nd `WorkOrderTimeEntry` for Job B
- **5:00 PM** - Completes Job B, clocks out
  - Clocks out of Job B: 3 hours spent
- **5:00 PM** - End of shift, clocks out (Timesheet)
  - Updates `TimeEntry` with `clockOut: 17:00`, `hoursWorked: 7.75` (8h - 0.25h lunch)

**Result:**
- 1 TimeEntry: 7.75 hours (used for payroll)
- 2 WorkOrderTimeEntries: 2.75h on Job A + 3h on Job B (used for analytics)

### Scenario 2: Multiple Techs on Same Job
- Job A needs 2 techs
- John clocks in: 9:00 AM
- Sarah clocks in: 9:30 AM (slightly late)
- Both work until 5:00 PM
- Creates 2 separate `WorkOrderTimeEntry` records
  - John: 8 hours
  - Sarah: 7.5 hours
- Can calculate blended labor cost for job
- Can see which techs contributed to job

---

## Payroll Calculation (Using Timesheet Only)

```javascript
// Don't use WorkOrderTimeEntry for payroll
const timeEntries = await prisma.timeEntry.findMany({
  where: {
    techId: "tech123",
    clockIn: { gte: payPeriodStart, lte: payPeriodEnd },
    approved: true  // Only approved entries
  }
});

const totalHours = timeEntries.reduce((sum, e) => sum + e.hoursWorked, 0);
const grossPay = totalHours * tech.hourlyRate;
```

---

## Job Profitability Analysis (Using Job Time Entries)

```javascript
// Calculate job profitability using job time entries
const jobEntries = await prisma.workOrderTimeEntry.findMany({
  where: {
    workOrderId: "wo123"
  }
});

const totalJobHours = jobEntries
  .filter(e => e.hoursSpent)
  .reduce((sum, e) => sum + e.hoursSpent, 0);

const laborCost = totalJobHours * laborRate;
const jobProfit = estimatedRevenue - laborCost - partsCost;
const profitMargin = (jobProfit / estimatedRevenue) * 100;
```

---

## Migration Guide (If Updating Existing System)

If upgrading from a single clock-in system:

1. **Run Prisma migration** to create `WorkOrderTimeEntry` table
   ```bash
   npx prisma migrate dev --name add_work_order_time_entries
   ```

2. **Update existing `TimeEntry` records** (optional backfill)
   - Leave existing records as-is if they worked for payroll
   - Future job tracking will use new `WorkOrderTimeEntry` model

3. **Update work order page** to include new `WorkOrderTimeClock` component

4. **Educate users**:
   - TimeEntry = payroll clock
   - WorkOrderTimeEntry = job tracking clock
   - Both can exist for same tech on same day

---

## Future Enhancements

- [ ] Job time entry reports and analytics dashboard
- [ ] Tech performance metrics (jobs per hour, accuracy of time estimates)
- [ ] Automatic suggestion of labor hours based on job time entries
- [ ] Time entry sync from job clock to timesheet (optional)
- [ ] Break-out time (time between jobs) analytics
- [ ] Job profitability report by tech
- [ ] Billable vs. non-billable time distinction
- [ ] Geofencing for automatic job clock-in/out

---

## Testing the Two Systems

### Test Timesheet Clock-In
1. Navigate to `/tech/timesheet`
2. Use TimeClock component to clock in/out
3. Verify TimeEntry created in database
4. Check that hours appear in timesheet

### Test Job Clock-In
1. Open a work order detail page
2. Scroll to WorkOrderTimeClock section
3. Click "Clock In to Job"
4. Verify WorkOrderTimeEntry created
5. Watch timer update in real-time
6. Clock out and verify hoursSpent calculated

---

## Support & Questions

For questions about which system to use:
- **Paying the employee?** → Use `TimeEntry` (Timesheet)
- **Tracking what work was done on a job?** → Use `WorkOrderTimeEntry` (Job Tracking)
- **Can't decide?** → Use both! They're independent.
