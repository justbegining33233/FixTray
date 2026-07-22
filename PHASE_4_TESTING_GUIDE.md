# Phase 4 Testing & Completion Guide

**Status**: All 6 features 80-95% complete. This document contains test cases and final polishing tasks.

---

## 🧪 Feature 1: Payment Refunds (2 days)

### ✅ Implementation Complete
- **Endpoint**: `POST /api/payment/refund`
- **GET**: `GET /api/payment/refund?workOrderId=xxx`
- **Validation**: 90-day window, payment must be 'paid', full/partial support
- **Audit**: Stored in `paymentRefund` table with processor info

### Test Cases

**TC1.1 - Full Refund (Happy Path)**
```bash
# 1. Pay for a work order ($100)
POST /api/payment/checkout
{ "workOrderId": "wo-001" }
→ Payment processed, status = 'paid', amountPaid = 100

# 2. Refund immediately
POST /api/payment/refund
{
  "paymentIntentId": "pi_xxx",
  "reason": "Customer requested"
}
→ Refund processed, work order status = 'pending', amountPaid = 0

# 3. Verify refund in history
GET /api/payment/refund?workOrderId=wo-001
→ Returns 1 refund with full amount, status = 'succeeded'
```

**TC1.2 - Partial Refund**
```bash
POST /api/payment/refund
{
  "paymentIntentId": "pi_xxx",
  "amount": 50
}
→ Refund $50, work order amountPaid becomes 50, status = 'pending'
```

**TC1.3 - 90-Day Window Violation**
```bash
# Pay for a work order 91 days ago, then try to refund
POST /api/payment/refund
{
  "paymentIntentId": "pi_xxx"
}
→ ERROR: "Refund window expired. Paid 91 days ago (90-day limit)"
```

**TC1.4 - Refund Amount Exceeds Paid**
```bash
POST /api/payment/refund
{
  "paymentIntentId": "pi_xxx",
  "amount": 200  # Paid was $100
}
→ ERROR: "Refund amount ($200) exceeds paid amount ($100)"
```

**TC1.5 - Only Paid Orders Can Be Refunded**
```bash
# Work order status = 'pending', paymentStatus = 'pending'
POST /api/payment/refund
{
  "paymentIntentId": "pi_xxx"
}
→ ERROR: "Only paid orders can be refunded"
```

### Expected Outcomes
- ✅ Full refunds reset work order to pending
- ✅ Partial refunds reduce amount paid
- ✅ 90-day window enforced
- ✅ Stripe refund creates audit trail
- ✅ Customer receives in-app notification
- ✅ Shop owner can view refund history

---

## 🔔 Feature 2: Push Notifications (3 days)

### ✅ Implementation Complete
- **Web Push**: Firefox, Chrome support
- **Service**: `/src/lib/serverPush.ts` with typed helpers
- **Subscribe**: `POST /api/push/subscribe`
- **Unsubscribe**: `POST /api/push/unsubscribe`
- **Send**: `POST /api/push/send-to-customer`

### Test Cases

**TC2.1 - Browser Permission & Subscription**
```bash
# 1. Request notification permission
await requestNotificationPermission()
→ Browser shows permission prompt
→ User allows/denies

# 2. Subscribe to push
await subscribeToPushNotifications()
→ Service worker registered
→ Subscription saved to DB
→ VAPID key validated

# 3. Verify subscription stored
GET /api/push/subscribe?userId=xxx
→ Returns subscription object with endpoint
```

**TC2.2 - Send Estimate Ready Notification**
```bash
# Shop sends estimate notification
POST /api/push/send-to-customer
{
  "customerId": "cust-001",
  "title": "Estimate Ready",
  "body": "Your estimate of $250 is ready for review",
  "tag": "estimate",
  "requireInteraction": true,
  "data": { "workOrderId": "wo-001", "url": "/customer/workorders/wo-001" }
}
→ Customer receives push notification (even if app closed)
→ Clicking opens work order page
```

**TC2.3 - Send Payment Confirmed Notification**
```bash
# After successful payment
POST /api/push/send-to-customer
{
  "customerId": "cust-001",
  "title": "Payment Confirmed",
  "body": "Payment of $250 received. Thank you!",
  "tag": "payment",
  "data": { "workOrderId": "wo-001" }
}
→ Real-time notification appears
```

**TC2.4 - Tech En Route Notification**
```bash
# Tech starts job
POST /api/push/send-to-customer
{
  "customerId": "cust-001",
  "title": "Tech On The Way!",
  "body": "John is heading to your location. ETA: 12 minutes",
  "tag": "tracking"
}
→ Customer notified in real-time
```

**TC2.5 - Retry on Failure**
```bash
# Invalid subscription in DB (expired endpoint)
→ sendPushToCustomer() catches 410 error
→ Automatically deletes expired subscription
→ Returns gracefully (no error to caller)
```

### Expected Outcomes
- ✅ Browser permission flow works
- ✅ Service worker registers successfully
- ✅ Notifications appear in real-time
- ✅ Expired subscriptions are auto-cleaned
- ✅ Links in notifications navigate correctly
- ✅ Works in Chromium, Firefox, Safari (where supported)

### Verification in Dev Server
```bash
npm run dev
# 1. Open http://localhost:3000
# 2. Allow notifications in browser
# 3. Trigger a work order → check notification appears
```

---

## 👁️ Feature 3: DVI Customer Approval (3 days)

### ✅ Implementation Complete
- **Tech Page**: `/tech/dvi` - Create & submit DVI
- **Customer Link**: `/customer/dvi/[token]` - Public approval page
- **Email**: Sent when shop submits to customer
- **Work Order Block**: Status = 'awaiting-customer-approval'
- **Endpoint**: `PUT /api/dvi/[id]/send-to-customer`

### Test Cases

**TC3.1 - Complete DVI Submission Flow**
```bash
# 1. Tech creates DVI
POST /api/dvi
{
  "vehicleDesc": "2019 Toyota Camry",
  "mileage": 85000,
  "items": [
    { "category": "Brakes", "itemName": "Brake Pads", "condition": "red", "estimatedCost": 150 },
    { "category": "Fluids", "itemName": "Oil Change", "condition": "green" }
  ]
}
→ DVI created with approvalToken = "abc123def456..."

# 2. Tech sends to customer
PUT /api/dvi/dvi-001/send-to-customer
→ Email sent to customer@email.com
→ DVI status = 'sent'
→ Work order status = 'awaiting-customer-approval'

# 3. Customer receives email
✉️ Subject: "Vehicle Inspection Ready for Review - 2019 Toyota Camry"
   Click: "Review Inspection & Approve Services" → opens /customer/dvi/abc123def456...

# 4. Customer views DVI
GET /customer/dvi/abc123def456...
→ Shows inspection summary
→ 1 Urgent issue, 0 Advisory, $150 estimated cost
→ "Approve Services" button visible

# 5. Customer approves
POST /api/dvi/token/abc123def456...
{
  "action": "approve"
}
→ DVI status = 'approved'
→ Work order status = 'in-progress' or 'waiting-for-payment'
→ Shop is notified

# 6. Manager sees approval
GET /shop/dvi
→ DVI shows "APPROVED" badge
→ Can proceed with work
```

**TC3.2 - Request Changes Flow**
```bash
# 1. Customer requests changes (UI button)
POST /api/dvi/token/abc123def456...
{
  "action": "request-changes",
  "notes": "Please verify the mileage reading"
}
→ DVI status = 'pending-review'
→ Shop receives notification
→ Work order remains 'awaiting-customer-approval'

# 2. Tech makes changes
PUT /api/dvi/dvi-001
{
  "items": [ /* updated items */ ]
}
→ DVI updated

# 3. Tech resends to customer
PUT /api/dvi/dvi-001/send-to-customer
→ Updated inspection sent to customer
```

**TC3.3 - Expired Link**
```bash
# 1. DVI created 31 days ago
# 2. Customer tries to approve via old email link
GET /customer/dvi/old-token-123
→ ERROR: "Inspection link expired or invalid"
```

**TC3.4 - Email Delivery**
```bash
# Verify email received by checking:
# 1. Gmail/test email inbox
# 2. Log in /api logs for sendEmail() calls
# 3. "Customer email notification logged" in Winston logs
```

### Expected Outcomes
- ✅ Email sent with approval link
- ✅ Customer link works immediately
- ✅ Customer can approve/request changes
- ✅ Work order blocked until approved
- ✅ Shop notified of approval status
- ✅ Links expire after 30 days

---

## 📦 Feature 4: Inventory Multi-Shop Transfers (3 days)

### ✅ Implementation 95% Complete
- **Endpoint**: `GET/POST /api/inventory/shared`
- **Page**: `/shop/inventory/shared`
- **Transfer**: Modal UI with qty/target shop select
- **Auto-Update**: Both shops updated immediately
- **History**: Activity logged

### Final Testing

**TC4.1 - View Shared Inventory**
```bash
# Shop owner has 2 locations with shared inventory
GET /api/inventory/shared
→ Returns items across both shops
→ Can filter "Low Stock Only" to see reorder-point items
```

**TC4.2 - Transfer Between Shops**
```bash
# From Shop A to Shop B
POST /api/inventory/shared
{
  "itemId": "inv-001",
  "fromShopId": "shop-a",
  "toShopId": "shop-b",
  "quantity": 5
}
→ Shop A inventory -= 5
→ Shop B inventory += 5 (create if doesn't exist)
→ Activity logged: "Transferred 5x Part Name from shop-a to shop-b"
```

**TC4.3 - Insufficient Stock**
```bash
POST /api/inventory/shared
{
  "itemId": "inv-001",
  "quantity": 100  # Only 20 available
}
→ ERROR: "Insufficient stock. Available: 20"
```

**TC4.4 - UI Polish**
- [ ] Transfer button on each row
- [ ] Modal shows from/to shops
- [ ] Qty spinner with max validation
- [ ] Success toast: "Transferred 5x Part Name"
- [ ] Error toast with reason
- [ ] Refresh inventory after transfer

### ✅ Ready for QA

---

## ⏱️ Feature 5: Break Tracking UI (2 days)

### ✅ Implementation 95% Complete
- **Start Break**: Button shows "Start Break" when clocked in
- **End Break**: Button changes to "End Break" when on break
- **Timer**: Real-time break duration display
- **Deduction**: Break time subtracted from work hours
- **Timesheet**: Breaks show in pay period summary

### Final Testing

**TC5.1 - Break Start/End Flow**
```bash
# 1. Tech clocks in at 9:00 AM
POST /api/time-tracking
{ "action": "clock-in", "techId": "tech-001" }
→ Elapsed time: 00:00:00
→ Button shows "Start Break"

# 2. Tech takes 15-minute break at 11:00 AM
POST /api/time-tracking
{ "action": "break-start", "techId": "tech-001" }
→ Break timer starts: 00:00:00
→ Button changes to "End Break"
→ Background turns orange

# 3. At 11:15 AM, end break
POST /api/time-tracking
{ "action": "break-end", "techId": "tech-001" }
→ Break ended
→ Elapsed time continues: 02:05:00 (2h 5m, skipping 15m break)
→ Button back to "Start Break"
```

**TC5.2 - Multiple Breaks**
```bash
# Tech takes 2 breaks in same shift
# 1st break: 9:30-9:45 (15 min)
# 2nd break: 12:00-12:30 (30 min)

# Total work: 8 hours - 45 min breaks = 7h 15m
```

**TC5.3 - Timesheet Shows Breaks**
```bash
# Go to /tech/timesheet
→ Shows "Clocked in (pay): 7.25 hrs"
→ Shows "Billable: 6.5 hrs" (if only 6.5 linked to work orders)
→ Individual entries show break duration
```

**TC5.4 - UI Polish**
- [ ] Break button color changes (orange on break)
- [ ] Real-time timer updates second-by-second
- [ ] Toast notifications: "Break started" / "Break ended"
- [ ] GPS verification works during break state
- [ ] Clock out blocked if on break (or auto-end break)

### ✅ Ready for QA

---

## 🔔 Feature 6: Recurring Reminders (2 days - Testing)

### ✅ Implementation 85% Complete
- **Service**: `/src/lib/recurringReminderService.ts` (6 functions)
- **Database**: `RecurringReminder` model with schedule
- **API**: POST/GET endpoints ready
- **Channels**: SMS (Twilio), Email (Resend), Push (Firebase)

### Testing Checklist

**TC6.1 - 7-Day Service Due Reminder**
```bash
# 1. Create recurring reminder
POST /api/recurring-reminders
{
  "customerId": "cust-001",
  "type": "service-due",
  "frequency": "once",
  "nextSend": "2026-01-28" // 7 days from now
}
→ Reminder scheduled

# 2. Verify in DB
SELECT * FROM recurring_reminders WHERE customerId = 'cust-001'
→ nextSend = tomorrow, status = 'pending'

# 3. Wait for cron job or manually trigger
POST /api/reminders/send-pending
→ Email sent: "Your oil change is due in 7 days"
→ SMS sent: "Service due reminder: oil change"
→ Push sent: "Service Due: Oil Change"
→ reminder.status = 'sent'
→ reminder.lastSent = NOW
```

**TC6.2 - 14-Day Inspection Reminder**
```bash
POST /api/recurring-reminders
{
  "customerId": "cust-001",
  "type": "inspection-due",
  "frequency": "weekly",
  "nextSend": "2026-01-27"
}
→ Repeats every 7 days automatically
```

**TC6.3 - Customer Approval Reminder**
```bash
POST /api/recurring-reminders
{
  "workOrderId": "wo-001",
  "type": "customer-approval",
  "frequency": "once",
  "nextSend": "2026-01-28" // 24 hours after DVI sent
}
→ Email: "Your inspection is waiting for your approval"
→ Customer clicks link → /customer/dvi/token
```

**TC6.4 - Email Delivery Verification**
- [ ] Check test email inbox for all 3 reminder types
- [ ] Verify SMS via Twilio console
- [ ] Verify push via browser/mobile
- [ ] Check Winston logs for "Reminder sent" entries
- [ ] Retry logic: if email fails, retry 3x with exponential backoff

**TC6.5 - Retry on Failure**
```bash
# 1. Send reminder but email provider is down
POST /api/reminders/send-pending
→ sendEmail() fails
→ Retry 1: Wait 5 sec, try again
→ Retry 2: Wait 30 sec, try again
→ Retry 3: Wait 300 sec (5 min), try again
→ If still failing, mark as failed in DB
```

### ✅ Ready for QA

---

## 📋 Manual QA Checklist

### All 6 Features

- [ ] **Refunds**: Full & partial refunds work, 90-day window enforced
- [ ] **Push Notifications**: Appear in browser, notifications click-through works
- [ ] **DVI Approval**: Email sent, customer link works, work order blocked
- [ ] **Inventory Transfers**: Items transfer between shops, stock updates
- [ ] **Break Tracking**: Breaks deducted from work hours, timesheet accurate
- [ ] **Recurring Reminders**: Email/SMS/Push delivered, retries work

### Cross-Feature Validation

- [ ] All endpoints return proper HTTP status codes (201 created, 400 bad request, etc.)
- [ ] All errors include descriptive messages
- [ ] Timestamps accurate in all tables
- [ ] Audit trails complete (who, what, when)
- [ ] No SQL injection vulnerabilities
- [ ] No XSS in notification content
- [ ] Rate limiting works (if configured)

### Performance

- [ ] Refund processing < 2 seconds
- [ ] Push send < 1 second
- [ ] Email send queued (async) < 100ms
- [ ] Transfer updates both shops < 500ms
- [ ] Reminder batch send < 5 seconds

---

## 🚀 Deployment Checklist

Before going live:

- [ ] All environment variables configured (STRIPE_SECRET_KEY, VAPID_PRIVATE_KEY, etc.)
- [ ] Database migrations applied
- [ ] Email service credentials (Resend/SendGrid)
- [ ] SMS service credentials (Twilio)
- [ ] Push service credentials (Firebase)
- [ ] Stripe connected account for refunds
- [ ] Cron job scheduled for recurring reminders (or use task queue)
- [ ] Error notifications set up (Sentry)
- [ ] Backup/recovery plan in place

---

## 📊 Estimated Timeline

**Days 1-2**: Complete remaining code (refunds, push, DVI email)  
**Days 3-4**: Manual QA testing all features  
**Days 5**: Fix bugs, optimize performance  
**Day 6**: Deployment prep, final verification  
**Day 7**: Go live & monitor

---

## 🎉 Success Criteria

✅ All 6 features working end-to-end  
✅ No critical bugs found during QA  
✅ Performance meets targets  
✅ All tests passing  
✅ Ready for production deployment
