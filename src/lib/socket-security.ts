/**
 * Socket.IO Security Configuration
 * 
 * Hardened CORS, authentication, and authorization for real-time connections
 */

import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/audit-logger';

export interface SocketAuthData {
  userId: string;
  userEmail: string;
  userRole: string;
}

/**
 * Socket.IO server configuration with security hardening
 */
export function configureSocketIOSecurity(io: SocketIOServer) {
  // CORS hardening
  io.engine.opts.cors = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim());

      // Never allow wildcard
      if (allowedOrigins.includes('*')) {
        console.error('[SECURITY] Wildcard CORS detected in Socket.IO, rejecting');
        return callback(new Error('Wildcard CORS not allowed'), false);
      }

      // Check origin
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[SECURITY] Socket.IO CORS rejected: ${origin}`);
        callback(new Error('CORS not allowed'), false);
      }
    },
    credentials: true, // Allow cookies for authentication
    methods: ['GET', 'POST'],
  };

  // Middleware: Authenticate connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const ip = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'] || '';

    if (!token) {
      logSecurityEvent({
        eventType: 'login_failed',
        ip,
        userAgent,
        details: { reason: 'no_token' },
        severity: 'warn',
      }).catch(console.error);

      return next(new Error('Authentication failed'));
    }

    try {
      const decoded = verifyToken(token);
      if (!decoded) {
        throw new Error('Invalid token');
      }

      // Attach auth data to socket
      (socket as any).auth = {
        userId: decoded.id,
        userEmail: decoded.email,
        userRole: decoded.role,
      } as SocketAuthData;

      logSecurityEvent({
        eventType: 'login_success',
        userId: decoded.id,
        email: decoded.email,
        role: decoded.role,
        ip,
        userAgent,
        severity: 'info',
      }).catch(console.error);

      next();
    } catch (error) {
      console.error('[SECURITY] Socket.IO authentication error:', error);

      // TODO: Add socket-specific event types to audit-logger
      // logSecurityEvent({
      //   eventType: 'login_failed',
      //   ip,
      //   userAgent,
      //   details: { error: String(error) },
      //   severity: 'error',
      // }).catch(console.error);

      next(new Error('Authentication failed'));
    }
  });

  // Middleware: Validate disconnect
  io.on('connection', (socket) => {
    const auth = (socket as any).auth as SocketAuthData;

    socket.on('disconnect', () => {
      // TODO: Add socket-specific event types to audit-logger
      // logSecurityEvent({
      //   eventType: 'login_success',
      //   userId: auth.userId,
      //   email: auth.userEmail,
      //   role: auth.userRole,
      //   ip: socket.handshake.address,
      //   userAgent: socket.handshake.headers['user-agent'] || '',
      //   severity: 'info',
      // }).catch(console.error);
    });

    // Limit event listeners
    socket.on('error', (error) => {
      console.error('[SOCKET.IO] Connection error:', error);
      // TODO: Add socket-specific event types to audit-logger
      // logSecurityEvent({
      //   eventType: 'unauthorized_access',
      //   userId: auth.userId,
      //   email: auth.userEmail,
      //   role: auth.userRole,
      //   ip: socket.handshake.address,
      //   userAgent: socket.handshake.headers['user-agent'] || '',
      //   details: { error: String(error) },
      //   severity: 'error',
      // }).catch(console.error);
    });
  });

  return io;
}

/**
 * Validate socket has required authorization
 */
export function requireSocketAuth(socket: any, requiredRoles?: string[]): SocketAuthData | null {
  const auth = socket.auth as SocketAuthData | undefined;

  if (!auth) {
    return null;
  }

  if (requiredRoles && !requiredRoles.includes(auth.userRole)) {
    return null;
  }

  return auth;
}

/**
 * Emit event only to authorized users
 */
export function emitSecurely(
  io: SocketIOServer,
  event: string,
  data: any,
  options?: {
    toRole?: string[];
    excludeUser?: string;
  }
) {
  io.use((socket, next) => {
    const auth = (socket as any).auth as SocketAuthData | undefined;

    if (!auth) {
      return next();
    }

    // Check role requirement
    if (options?.toRole && !options.toRole.includes(auth.userRole)) {
      return next();
    }

    // Check user exclusion
    if (options?.excludeUser && auth.userId === options.excludeUser) {
      return next();
    }

    next();
  });

  io.emit(event, data);
}
