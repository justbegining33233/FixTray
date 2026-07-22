/**
 * FIXTRAY SOCKET.IO SERVER - PRODUCTION READY
 * Standalone Socket.IO server with Redis pub/sub for multi-instance support
 * 
 * DEPLOYMENT TARGETS:
 *   - Railway (recommended - $5/mo free tier)
 *   - Render (free tier available)
 *   - Fly.io ($5 credit free tier)
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 *   PORT                    - TCP port (default: 3001)
 *   JWT_SECRET              - Same as Vercel JWT_SECRET
 *   REDIS_URL              - Redis connection string (e.g., redis://...)
 *   NODE_ENV               - 'production' or 'development'
 *   ALLOWED_ORIGINS        - Comma-separated CORS origins
 *   LOG_LEVEL              - 'debug', 'info', 'warn', 'error' (default: 'info')
 * 
 * DEPLOYMENT COMMANDS:
 *   Local: node socket-server-v2.js
 *   Railway: railway up
 *   Render: git push render main
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const redis = require('redis');

// ─── CONFIGURATION ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'https://fixtray.app', 'https://www.fixtray.app'];

// Production validation
if (NODE_ENV === 'production') {
  if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET must be set in production');
    process.exit(1);
  }
  if (!REDIS_URL || REDIS_URL === 'redis://localhost:6379') {
    console.error('FATAL: REDIS_URL must be configured for production');
    process.exit(1);
  }
}

const jwtSecret = JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-prod';

// ─── LOGGING ─────────────────────────────────────────────────────────
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLogLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.info;

const logger = {
  debug: (msg, data) => {
    if (currentLogLevel <= LOG_LEVELS.debug) {
      console.log(`[${new Date().toISOString()}] DEBUG: ${msg}`, data || '');
    }
  },
  info: (msg, data) => {
    if (currentLogLevel <= LOG_LEVELS.info) {
      console.log(`[${new Date().toISOString()}] INFO: ${msg}`, data || '');
    }
  },
  warn: (msg, data) => {
    if (currentLogLevel <= LOG_LEVELS.warn) {
      console.warn(`[${new Date().toISOString()}] WARN: ${msg}`, data || '');
    }
  },
  error: (msg, error) => {
    if (currentLogLevel <= LOG_LEVELS.error) {
      console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, error?.message || error || '');
    }
  },
};

// ─── REDIS SETUP ─────────────────────────────────────────────────────
let redisPublisher, redisSubscriber;
let redisConnected = false;

async function initRedis() {
  try {
    redisPublisher = redis.createClient({ url: REDIS_URL });
    redisSubscriber = redis.createClient({ url: REDIS_URL });

    redisPublisher.on('error', err => logger.error('Redis publisher error', err));
    redisSubscriber.on('error', err => logger.error('Redis subscriber error', err));

    await redisPublisher.connect();
    await redisSubscriber.connect();

    redisConnected = true;
    logger.info('Redis connected successfully');
  } catch (error) {
    if (NODE_ENV === 'production') {
      logger.error('Failed to connect to Redis', error);
      process.exit(1);
    } else {
      logger.warn('Redis not available in development mode', error?.message);
      redisConnected = false;
    }
  }
}

// ─── HTTP SERVER ─────────────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        uptime: process.uptime(),
        redis: redisConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Metrics endpoint
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        connectedClients: io.engine.clientsCount,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      })
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── SOCKET.IO SETUP ─────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io',
  serveClient: false,
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6, // 1MB
  perMessageDeflate: {
    threshold: 1024,
  },
});

// Attach Redis adapter for multi-instance support
if (redisConnected) {
  const { createAdapter } = require('@socket.io/redis-adapter');
  io.adapter(
    createAdapter(redisPublisher, redisSubscriber, {
      key: 'socket.io',
    })
  );
  logger.info('Redis adapter initialized');
}

// ─── JWT AUTHENTICATION ──────────────────────────────────────────────
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      logger.warn('Connection attempt without token', { socketId: socket.id });
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, jwtSecret);
    socket.data.user = decoded;
    socket.data.connectedAt = new Date();
    logger.debug('User authenticated', {
      socketId: socket.id,
      userId: decoded.id,
      role: decoded.role,
    });
    next();
  } catch (error) {
    logger.warn('JWT verification failed', {
      socketId: socket.id,
      error: error.message,
    });
    next(new Error('Invalid token'));
  }
});

// ─── CONNECTION HANDLER ──────────────────────────────────────────────
io.on('connection', (socket) => {
  const { id: userId, role, shopId } = socket.data.user || {};

  logger.info('Client connected', {
    socketId: socket.id,
    userId,
    role,
    shopId,
  });

  // Join personal rooms for targeting
  if (userId) socket.join(`user:${userId}`);
  if (shopId) socket.join(`shop:${shopId}`);
  if (role === 'admin' || role === 'superadmin') socket.join('admin');

  // ─── WORK ORDER EVENTS ────────────────────────────────────────────
  socket.on('work-order-update', (data) => {
    const room = shopId ? `shop:${shopId}` : null;
    if (!room) {
      logger.warn('work-order-update received but no shopId', { socketId: socket.id });
      return;
    }

    logger.debug('work-order-update', {
      socketId: socket.id,
      workOrderId: data.workOrderId,
      room,
    });

    io.to(room).emit('work-order-updated', {
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    });
  });

  socket.on('work-order-status-changed', (data) => {
    const room = shopId ? `shop:${shopId}` : null;
    if (room) {
      logger.debug('work-order-status-changed', {
        socketId: socket.id,
        workOrderId: data.workOrderId,
        newStatus: data.status,
      });

      io.to(room).emit('work-order-status-changed', {
        ...data,
        changedAt: new Date().toISOString(),
        changedBy: userId,
      });
    }
  });

  // ─── MESSAGING EVENTS ─────────────────────────────────────────────
  socket.on('send-message', (data) => {
    const { toUserId, conversationId, message } = data;

    if (!toUserId) {
      logger.warn('send-message without toUserId', { socketId: socket.id });
      return;
    }

    logger.debug('send-message', {
      fromUserId: userId,
      toUserId,
      conversationId,
    });

    // Send to recipient
    io.to(`user:${toUserId}`).emit('new-message', {
      fromUserId: userId,
      conversationId,
      message,
      timestamp: new Date().toISOString(),
    });

    // Confirm to sender
    socket.emit('message-sent', {
      conversationId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('typing-start', (data) => {
    const { toUserId, conversationId } = data;
    if (toUserId) {
      io.to(`user:${toUserId}`).emit('user-typing', {
        fromUserId: userId,
        conversationId,
      });
    }
  });

  socket.on('typing-stop', (data) => {
    const { toUserId, conversationId } = data;
    if (toUserId) {
      io.to(`user:${toUserId}`).emit('user-stopped-typing', {
        fromUserId: userId,
        conversationId,
      });
    }
  });

  // ─── TECH LOCATION UPDATES ────────────────────────────────────────
  socket.on('location-update', (data) => {
    const room = shopId ? `shop:${shopId}` : null;
    if (!room) {
      logger.warn('location-update received but no shopId', { socketId: socket.id });
      return;
    }

    logger.debug('location-update', {
      socketId: socket.id,
      userId,
      latitude: data.latitude,
      longitude: data.longitude,
    });

    io.to(room).emit('tech-location-updated', {
      techId: userId,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── CLOCK-IN / CLOCK-OUT ─────────────────────────────────────────
  socket.on('clock-status-change', (data) => {
    const room = shopId ? `shop:${shopId}` : null;
    if (!room) {
      logger.warn('clock-status-change received but no shopId', { socketId: socket.id });
      return;
    }

    logger.info('clock-status-change', {
      socketId: socket.id,
      techId: userId,
      status: data.status,
    });

    io.to(room).emit('clock-status-changed', {
      techId: userId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── PRESENCE ─────────────────────────────────────────────────────
  socket.on('set-presence', (data) => {
    socket.data.presence = data.status; // 'online', 'away', 'busy'
    const room = shopId ? `shop:${shopId}` : null;
    if (room) {
      io.to(room).emit('user-presence-changed', {
        userId,
        status: data.status,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── DISCONNECT ────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    logger.info('Client disconnected', {
      socketId: socket.id,
      userId,
      reason,
      connectedDuration: Date.now() - socket.data.connectedAt,
    });

    // Notify shop that tech went offline
    if (shopId && role === 'tech') {
      io.to(`shop:${shopId}`).emit('tech-offline', {
        techId: userId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on('error', (err) => {
    logger.error('Socket error', {
      socketId: socket.id,
      userId,
      error: err?.message || err,
    });
  });

  // ─── PING/PONG (heartbeat) ────────────────────────────────────────
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close socket connections
  io.close();

  // Close Redis connections
  if (redisConnected) {
    Promise.all([
      redisPublisher?.quit(),
      redisSubscriber?.quit(),
    ]).then(() => {
      logger.info('Redis connections closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.emit('SIGTERM');
});

// ─── STARTUP ──────────────────────────────────────────────────────────
async function start() {
  try {
    // Initialize Redis if available
    await initRedis();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info('Socket server started', {
        port: PORT,
        env: NODE_ENV,
        redis: redisConnected ? 'enabled' : 'disabled',
        origins: ALLOWED_ORIGINS,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

start();

module.exports = { io, httpServer };
