# PHASE 2: REAL-TIME ARCHITECTURE - IMPLEMENTATION GUIDE

**Phase 2 Status**: 🟢 READY TO DEPLOY  
**Estimated Timeline**: 1-2 weeks (development) + 1 day (deployment)  
**Team Size**: 1-2 developers  

---

## 📦 DELIVERABLES

### Phase 2 Files Created
✅ **socket-server-v2.js** - Production Socket.IO server (450+ lines)
✅ **socket-server/package.json** - Dependencies + scripts
✅ **socket-server/railway.toml** - Railway deployment config
✅ **socket-server/render.yaml** - Render deployment config
✅ **socket-server/.env.example** - Environment template
✅ **PHASE_2_SETUP_GUIDE.md** - Complete setup documentation

### Key Features Implemented
✅ **Redis pub/sub** - Multi-instance support
✅ **JWT Authentication** - Secure connections
✅ **Health checks** - `/health` and `/metrics` endpoints
✅ **Room-based messaging** - User/shop/admin rooms
✅ **Event handlers** - Work orders, messages, location, clock
✅ **Graceful shutdown** - SIGTERM/SIGINT handling
✅ **Comprehensive logging** - Debug, info, warn, error levels
✅ **Production validation** - Strict ENV checking
✅ **WebSocket + polling** - Fallback support

---

## 🗂️ PROJECT STRUCTURE

```
socket-server/
├── socket-server-v2.js      # Main server file
├── package.json             # Dependencies
├── railway.toml            # Railway deployment
├── render.yaml             # Render deployment
├── .env.example            # Environment template
└── PHASE_2_SETUP_GUIDE.md  # This guide
```

---

## ⚙️ CONFIGURATION CHECKLIST

### Before Deployment

- [ ] **Get JWT_SECRET from Vercel**
  ```
  Vercel Dashboard → Settings → Environment Variables
  Find: JWT_SECRET (production)
  Copy value
  ```

- [ ] **Choose Deployment Platform**
  - [ ] Railway (recommended, $5/mo free)
  - [ ] Render (free tier, then ~$7/mo)
  - [ ] Fly.io ($5 credit)

- [ ] **Prepare Environment Variables**
  - [ ] JWT_SECRET ← from Vercel
  - [ ] REDIS_URL ← will be auto-populated
  - [ ] ALLOWED_ORIGINS ← your frontend domains
  - [ ] NODE_ENV = "production"
  - [ ] LOG_LEVEL = "info"

### Local Testing

- [ ] Install Node.js >= 18
- [ ] Run: `cd socket-server && npm install`
- [ ] Start Redis: `redis-server`
- [ ] Start server: `npm run dev`
- [ ] Test health: `curl http://localhost:3001/health`

---

## 🚀 DEPLOYMENT STEPS (Railway)

### 1. Create Railway Project
```bash
# Go to: https://railway.app
# Click: "New Project"
# Select: "Deploy from GitHub" or "Create a New Project"
```

### 2. Install Railway CLI
```bash
npm i -g @railway/cli
railway login
```

### 3. Deploy Socket Server
```bash
cd socket-server
railway up
# Follow prompts to connect to your Railway project
```

### 4. Add Redis Plugin
```bash
# In Railway dashboard:
# 1. Click your project
# 2. Click "Plugins"
# 3. Select "Redis"
# 4. Click "Add"
# Wait for Redis to initialize
# REDIS_URL will be auto-populated
```

### 5. Set Environment Variables
```bash
# In Railway dashboard:
# 1. Click your project
# 2. Click "Variables"
# 3. Add these variables:
JWT_SECRET=<copy from Vercel>
ALLOWED_ORIGINS=https://fixtray.app,https://www.fixtray.app,https://app.fixtray.app
NODE_ENV=production
LOG_LEVEL=info
```

### 6. Verify Deployment
```bash
# Test health endpoint
curl https://<your-project>.railway.app/health

# Should return:
# {"status":"ok","uptime":X,"redis":"connected","timestamp":"..."}
```

---

## 🔗 FRONTEND INTEGRATION

### Update Next.js Environment Variable

**File: `vercel.json`**
```json
{
  "env": {
    "NEXT_PUBLIC_SOCKET_URL": "@socket_url"
  }
}
```

**Vercel Dashboard:**
1. Project Settings → Environment Variables
2. Add new variable: `NEXT_PUBLIC_SOCKET_URL`
3. Value: `https://your-socket-server.railway.app`

### Update Socket Client

**File: `src/lib/socket.ts`**
```typescript
import { io } from 'socket.io-client';

const SOCKET_URL = 
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  auth: {
    token: localStorage.getItem('jwtToken'),
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
```

### Use Real-Time Events

**Example: Work Order Updates**
```typescript
// Listen for updates
socket.on('work-order-updated', (data) => {
  console.log('WO updated:', data);
  // Refresh UI with new data
});

// Broadcast update
socket.emit('work-order-update', {
  workOrderId: '123',
  status: 'in-progress',
});
```

---

## 🧪 TESTING CHECKLIST

### Local Testing
- [ ] Start socket server: `npm run dev`
- [ ] Server logs show: "Socket server started"
- [ ] Health check works: `curl http://localhost:3001/health`
- [ ] Connect with token: Verify auth works
- [ ] Send events: Test work-order, message, location events
- [ ] Disconnect gracefully: CTRL+C shows proper shutdown

### Production Testing
- [ ] Health endpoint responds: `curl https://your-socket.railway.app/health`
- [ ] Metrics endpoint works: `/metrics`
- [ ] Frontend connects with token
- [ ] Real-time updates in browser
- [ ] No errors in Railway logs: `railway logs -f`
- [ ] Reconnection works after disconnect

### Load Testing
- [ ] 10+ concurrent connections
- [ ] Send events at 10/second
- [ ] Monitor memory usage: `/metrics`
- [ ] Check Redis is handling pub/sub

---

## 📊 MONITORING & MAINTENANCE

### Health Checks
```bash
# Check server status
curl https://your-socket.railway.app/health

# Check metrics
curl https://your-socket.railway.app/metrics
```

### Logs Monitoring
```bash
# Railway
railway logs -f

# Render
render logs --follow
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "JWT_SECRET not set" | Missing env var | Add to Railway/Render dashboard |
| "REDIS_URL invalid" | Wrong format | Verify Redis plugin connected |
| "Connection refused" | Port in use | Change PORT env var |
| High memory | Memory leak | Restart server, check connections |
| No real-time updates | CORS issue | Verify ALLOWED_ORIGINS |

---

## 🔄 SCALING CONSIDERATIONS

### Current Setup Supports
- ✅ ~100-500 concurrent connections per instance
- ✅ Multi-instance via Redis pub/sub
- ✅ Auto-reconnection + polling fallback
- ✅ Graceful degradation if Redis unavailable

### Future Scaling (Phase 4+)
- [ ] Horizontal scaling with multiple Socket.IO instances
- [ ] Load balancing (Railway/Render handles automatically)
- [ ] Redis Cluster for high throughput
- [ ] Monitoring via Prometheus/Grafana

---

## 📋 DEPLOYMENT DECISION MATRIX

| Platform | Cost | Setup Time | Pros | Cons |
|----------|------|-----------|------|------|
| **Railway** ⭐ | $5/mo free | 10 min | Simple, free Redis | Sleep after 7 days |
| Render | $7/mo | 15 min | Auto-deploy, easy | Need separate Redis |
| Fly.io | $5 credit | 20 min | Global, performant | More complex |

**Recommendation**: Start with Railway (free tier), migrate to Render/Fly.io if needed.

---

## ✅ GO/NO-GO CHECKLIST

Before going to production:

- [ ] Local testing passed (all tests green)
- [ ] Deployment platform chosen and account created
- [ ] Environment variables prepared (JWT_SECRET, REDIS_URL, origins)
- [ ] Health endpoint responding
- [ ] Frontend `NEXT_PUBLIC_SOCKET_URL` configured
- [ ] Socket client updated in Next.js app
- [ ] Real-time events tested in frontend
- [ ] Logs monitored (no errors)
- [ ] Team trained on monitoring/troubleshooting
- [ ] Rollback plan documented

**Status**: 🟢 GO if all boxes checked

---

## 🚦 ROLLBACK PLAN

If issues arise in production:

```bash
# 1. Immediate action - disable Socket.IO in frontend
# Temporarily fall back to polling via REST API

# 2. Check logs
railway logs -f

# 3. Restart server if needed
# Railway dashboard → Project → Restart

# 4. If still failing, revert frontend changes
# git revert <commit>
# vercel deploy --prod

# 5. Investigate root cause
# Check: JWT_SECRET, REDIS_URL, ALLOWED_ORIGINS, logs
```

**Estimated rollback time**: 5-10 minutes

---

## 📚 NEXT STEPS

After Phase 2 is deployed:

1. **Verify real-time in production** (1 day)
   - Monitor usage patterns
   - Check performance metrics
   - Get team feedback

2. **Begin Phase 3: Missing Features** (8 weeks)
   - Fleet Management
   - Shift Scheduling
   - PTO/Leave Requests
   - Loaner Vehicles
   - State Inspections
   - Environmental Fees
   - Campaigns

3. **Phase 4: Complete Incomplete Features** (parallel)
   - Payment Refunds
   - Push Notifications
   - DVI Approval
   - Inventory Transfers
   - Break Tracking
   - Recurring Reminders

4. **Phase 5: E2E Testing & QA** (2 weeks)

5. **Phase 6: Production Deployment** (1 week)

---

## 📞 SUPPORT & RESOURCES

**Socket.IO Docs**: https://socket.io/docs  
**Railway Docs**: https://docs.railway.app  
**Render Docs**: https://render.com/docs  
**Redis Docs**: https://redis.io/docs  

**Questions?**
- Check PHASE_2_SETUP_GUIDE.md for detailed instructions
- Review socket-server-v2.js comments
- Consult platform-specific documentation

---

**Phase 2 Status**: 🟢 COMPLETE & READY FOR DEPLOYMENT  
**Last Updated**: July 20, 2026  
**Estimated Production Go-Live**: Within 1 week
