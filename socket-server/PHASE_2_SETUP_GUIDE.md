# Phase 2 Setup Guide - Socket.IO Real-Time Server

**Status**: Phase 2 Implementation - Real-Time Architecture  
**Timeline**: 1-2 weeks for full deployment  
**Effort**: 40-60 hours (2-3 developers)

---

## 📋 OVERVIEW

Phase 2 implements real-time updates for FixTray using a separate Socket.IO server with Redis pub/sub support. This enables:

- ✅ Real-time work order status updates (< 100ms)
- ✅ Live tech location tracking
- ✅ Instant messaging and notifications
- ✅ Multi-instance support via Redis
- ✅ Graceful fallback to polling if disconnected
- ✅ Production-ready error handling and logging

**Key Architecture:**
```
┌─────────────────────────────────────────────────────┐
│  Frontend (Vercel/FixTray.app)                      │
│  - Next.js app                                      │
│  - WebSocket client (socket.io-client)             │
│  - Fallback to polling if Socket.IO unavailable    │
└────────────┬────────────────────────────────────────┘
             │ WebSocket
             │ 
┌────────────▼────────────────────────────────────────┐
│  Socket.IO Server (Railway/Render)                  │
│  - Handles real-time connections                   │
│  - Manages namespaces + rooms                       │
│  - JWT authentication                              │
└────────────┬────────────────────────────────────────┘
             │ Pub/Sub
             │
┌────────────▼────────────────────────────────────────┐
│  Redis (Upstash/Railway)                            │
│  - Enables multi-instance support                  │
│  - Broadcasts events across server instances       │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 DEPLOYMENT OPTIONS

### Option 1: Railway (Recommended ⭐)
**Cost**: $5/mo free tier (covers ~2-3 months)  
**Pros**: Simple setup, free Redis plugin, auto-scaling  
**Cons**: Sleep after 7 days of inactivity (pro tier needed for always-on)

**Setup Steps:**
```bash
1. Create account: https://railway.app
2. Install CLI: npm i -g @railway/cli
3. Login: railway login
4. Navigate to socket-server folder: cd socket-server
5. Deploy: railway up
6. Add Redis plugin in dashboard → auto-sets REDIS_URL
7. Set environment variables (JWT_SECRET, ALLOWED_ORIGINS)
```

### Option 2: Render
**Cost**: ~$7/month after free tier  
**Pros**: Auto-deploy on git push, free tier available  
**Cons**: Need separate Redis service

**Setup Steps:**
```bash
1. Create account: https://render.com
2. Connect GitHub repository
3. Create Web Service → select socket-server folder
4. Use render.yaml configuration
5. Connect Render Redis service (paid tier)
6. Set environment variables
7. Deploy
```

### Option 3: Fly.io
**Cost**: $5 credit free tier  
**Pros**: Global deployment, strong performance  
**Cons**: More complex setup

---

## 🔧 ENVIRONMENT CONFIGURATION

### Required Variables

Copy these into your deployment platform (Railway, Render, etc.):

```env
# CRITICAL - Must match Vercel JWT_SECRET
JWT_SECRET=your_jwt_secret_from_vercel

# Redis connection (auto-populated by Redis plugin/service)
REDIS_URL=redis://default:password@host:port

# Allowed origins (comma-separated, no spaces)
ALLOWED_ORIGINS=https://fixtray.app,https://www.fixtray.app,https://app.fixtray.app

# Environment
NODE_ENV=production

# Logging level: debug, info, warn, error
LOG_LEVEL=info

# Port (usually auto-assigned by platform)
PORT=3001
```

### Get JWT_SECRET from Vercel
```bash
1. Go to: https://vercel.com/fixtray/settings/environment-variables
2. Find JWT_SECRET variable
3. Copy value
4. Paste into Railway/Render environment variables
```

### Get REDIS_URL

**Railway:**
- Dashboard → Project → Plugins → Add Plugin → Redis
- Redis plugin auto-populates REDIS_URL

**Render:**
- Create Redis service separately
- Copy connection string
- Set as REDIS_URL

**Upstash (alternative):**
```bash
1. Create account: https://upstash.com
2. Create Redis database
3. Copy REST URL
4. Convert to node-redis format:
   # From: https://default:token@host:port
   # To: redis://:token@host:port
```

---

## 💾 LOCAL DEVELOPMENT

### Prerequisites
```bash
node >= 18
npm >= 9
redis-server (for local testing)
```

### Start Local Socket Server
```bash
# Install dependencies
cd socket-server
npm install

# Start Redis locally (separate terminal)
redis-server

# Start socket server (development mode)
npm run dev

# Server should print: "Socket server started on port 3001"
```

### Test Connection
```bash
# Open another terminal
curl http://localhost:3001/health
# Should return: {"status":"ok","uptime":...,"redis":"connected"}

# Check metrics
curl http://localhost:3001/metrics
# Should return: {"connectedClients":0,"uptime":...,"memory":{...}}
```

---

## 📱 FRONTEND INTEGRATION

### Update Next.js to Use New Socket Server

**File: `src/lib/socket.ts`**
```typescript
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  auth: {
    token: localStorage.getItem('jwtToken'), // Get from auth context
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'], // WebSocket + polling fallback
});

// Event listeners
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

**File: `vercel.json`** (environment variable)
```json
{
  "env": {
    "NEXT_PUBLIC_SOCKET_URL": "@socket_url"
  }
}
```

**Vercel Dashboard:**
- Settings → Environment Variables
- Add: `NEXT_PUBLIC_SOCKET_URL` = `https://your-socket-server.railway.app`

### Real-Time Usage Examples

**Work Order Updates:**
```typescript
// Client listens for updates
socket.on('work-order-updated', (data) => {
  console.log('Work order updated:', data);
  // Update local state, refresh UI
});

// Broadcast update from any client
socket.emit('work-order-update', {
  workOrderId: '123',
  status: 'in-progress',
  updatedAt: new Date(),
});
```

**Tech Location:**
```typescript
// Broadcast location every 10 seconds
setInterval(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      socket.emit('location-update', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    });
  }
}, 10000);
```

**Messaging:**
```typescript
// Send message in real-time
socket.emit('send-message', {
  toUserId: recipientId,
  conversationId: convId,
  message: 'Hello!',
});

// Listen for new messages
socket.on('new-message', (data) => {
  console.log('New message from:', data.fromUserId, data.message);
});
```

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Local testing: `npm run dev` with Redis
- [ ] All tests passing: `npm test`
- [ ] Environment variables documented
- [ ] JWT_SECRET copied from Vercel
- [ ] Allowed origins configured correctly

### Deployment (Railway Example)
- [ ] Create Railway account & project
- [ ] Initialize: `railway init`
- [ ] Add Redis plugin: Dashboard → Plugins
- [ ] Set environment variables:
  - [ ] JWT_SECRET
  - [ ] ALLOWED_ORIGINS
  - [ ] NODE_ENV=production
- [ ] Deploy: `railway up`
- [ ] Test health: `curl https://your-project.railway.app/health`

### Post-Deployment
- [ ] Health check returns `{"status":"ok"}`
- [ ] Metrics accessible: `/metrics`
- [ ] Frontend can connect with new `NEXT_PUBLIC_SOCKET_URL`
- [ ] Real-time updates working in frontend
- [ ] No error logs in socket server
- [ ] Redis connected: `redis: "connected"` in health check

### Monitoring
- [ ] Check dashboard for crashes
- [ ] Monitor Redis connection status
- [ ] Watch for memory leaks
- [ ] Verify auto-reconnection working

---

## 🐛 TROUBLESHOOTING

### Socket Server Won't Start
```bash
# Check logs
railway logs -f
# or
render logs

# Common issues:
# 1. JWT_SECRET not set → will crash on connection
# 2. REDIS_URL invalid → runs in offline mode (dev)
# 3. PORT already in use → change PORT env var
```

### Frontend Can't Connect
```bash
# Check if socket server is running
curl https://socket-server-url/health

# Check NEXT_PUBLIC_SOCKET_URL is correct
# In browser console: console.log(process.env.NEXT_PUBLIC_SOCKET_URL)

# Check CORS origins configured
# Should match frontend domain exactly

# Try switching transports
# Edit src/lib/socket.ts → try ['polling'] first, then add 'websocket'
```

### High Memory Usage
```bash
# Check connected clients
curl https://socket-server-url/metrics

# Restart server if needed
# Dashboard → Project → Restart

# Monitor with more detailed logging
# Change LOG_LEVEL=debug in environment
```

### Redis Connection Failed
```bash
# Check REDIS_URL format
# Should be: redis://[:password]@host:port

# Test Redis connection locally
redis-cli ping
# Should return: PONG

# If using Upstash, convert REST URL to node-redis format
```

---

## 📊 PERFORMANCE TARGETS

| Metric | Target | Monitor |
|--------|--------|---------|
| Connection latency | < 100ms | Browser DevTools |
| Message delivery | < 50ms | Application logs |
| Server memory | < 256MB | `/metrics` endpoint |
| Error rate | < 0.1% | Sentry dashboard |
| Uptime | > 99.9% | Railway/Render dashboard |

---

## 🔐 SECURITY NOTES

1. **JWT Validation**: Every connection verifies JWT token
2. **Origin Restriction**: CORS only allows specified origins
3. **Room-Based Access**: Users only see data from their shop/personal room
4. **No Direct Database Access**: Socket server reads JWT, not database
5. **Environment Variables**: Never commit secrets to git

---

## 🎯 WHAT'S NEXT (Phase 3)

After Phase 2 is deployed:
- Implement 9 missing features (Fleet, Shifts, PTO, etc.)
- Complete 6 incomplete features
- End-to-end testing
- Production deployment

---

## 📞 SUPPORT

**Issues with deployment?**
- Railway docs: https://docs.railway.app
- Render docs: https://render.com/docs
- Socket.IO docs: https://socket.io/docs
- Redis docs: https://redis.io/commands

**Need help?**
- Check logs in deployment dashboard
- Verify environment variables are set
- Test health endpoint: `/health`
- Review socket-server-v2.js logging output

---

**Phase 2 Status**: 🟡 READY TO DEPLOY  
**Estimated Timeline**: 1-2 weeks (dev) + 1 day (deployment)  
**Team Size**: 1-2 developers

