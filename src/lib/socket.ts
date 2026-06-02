/**
 * useSocket — Real-time hook using Socket.IO client with polling fallback.
 *
 * Connects to the Socket.IO server specified by NEXT_PUBLIC_SOCKET_URL.
 * Falls back to REST polling if the env var is not set or connection fails.
 *
 * Fires window CustomEvents so existing component listeners keep working:
 *   work-order:updated, chat:new-message, chat:typing, etc.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Socket → Window event name mapping ──────────────────────────────────────
const EVENT_MAP: Record<string, string> = {
  'work-order-updated':    'work-order:updated',
  'new-message':           'chat:new-message',
  'user-typing':           'chat:typing',
  'user-stopped-typing':   'chat:stopped-typing',
  'tech-location-updated': 'tech:location_updated',
  'clock-status-changed':  'clock:status_changed',
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ServerToClientEvents {
  'work-order-updated': (data: any) => void;
  'new-message': (data: any) => void;
  'user-typing': (data: any) => void;
  'user-stopped-typing': (data: any) => void;
  'tech-location-updated': (data: any) => void;
  'clock-status-changed': (data: any) => void;
}

export interface ClientToServerEvents {
  'work-order-update': (data: any) => void;
  'send-message': (data: any) => void;
  'typing-start': (data: any) => void;
  'typing-stop': (data: any) => void;
  'location-update': (data: any) => void;
  'clock-status-change': (data: any) => void;
}

// ─── Helper: dispatch a window CustomEvent ───────────────────────────────────
function dispatch(windowEvent: string, detail: unknown) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(windowEvent, { detail }));
  }
}

// ─── Singleton Socket.IO connection ──────────────────────────────────────────
let socketInstance: Socket | null = null;
let socketConnected = false;

function shouldUseSocketInCurrentEnv(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'true') return false;
  // Require an explicit socket server URL.
  // Vercel serverless functions cannot host a persistent Socket.IO connection,
  // so we must never fall back to the app's own origin.
  // If no URL is configured, getSocket() returns null and the polling fallback
  // in useSocket() takes over automatically.
  if (!process.env.NEXT_PUBLIC_SOCKET_URL) return false;
  if (process.env.NODE_ENV === 'production') return true;
  return process.env.NEXT_PUBLIC_ENABLE_SOCKET_IN_DEV === 'true';
}

function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (socketInstance) return socketInstance;
  if (!shouldUseSocketInCurrentEnv()) return null;

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL!;
  if (!socketUrl) return null; // guarded above, but keep as safety net

  const token = localStorage.getItem('token');
  if (!token) return null;

  socketInstance = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socketInstance.on('connect', () => {
    socketConnected = true;
    const shopId = localStorage.getItem('shopId');
    const userId = localStorage.getItem('userId');
    if (shopId) socketInstance?.emit('join-shop', shopId);
    if (userId) socketInstance?.emit('join-user', userId);
  });

  socketInstance.on('disconnect', () => { socketConnected = false; });
  socketInstance.on('connect_error', () => { socketConnected = false; });

  // Forward all server events to window CustomEvents
  Object.entries(EVENT_MAP).forEach(([socketEvent, windowEvent]) => {
    socketInstance?.on(socketEvent, (data: any) => {
      dispatch(windowEvent, data);
    });
  });

  return socketInstance;
}

// ─── Polling fallback (when Socket.IO server is not configured) ──────────────
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let prevWorkOrderSnapshot: Record<string, string> = {};
let prevMessageSnapshot: Record<string, string> = {};

async function poll() {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('token');
  if (!token) return;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  // ── Work orders ─────────────────────────────────────────────────────────
  try {
    const res = await fetch('/api/workorders', { headers, credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      const orders: any[] = data.workOrders ?? data ?? [];
      const next: Record<string, string> = {};

      for (const wo of orders) {
        const stamp = wo.updatedAt ?? wo.createdAt ?? '';
        next[wo.id] = stamp;
        const prev = prevWorkOrderSnapshot[wo.id];
        if (prev !== undefined && prev !== stamp) {
          dispatch('work-order:updated', {
            workOrderId: wo.id,
            action: 'updated',
            status: wo.status,
            updatedBy: wo.assignedTo ?? 'system',
            timestamp: stamp,
          });
        }
      }
      prevWorkOrderSnapshot = next;
    }
  } catch { /* network error */ }

  // ── Messages ──────────────────────────────────────────────────────────────
  try {
    const res = await fetch('/api/messages', { headers, credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      const conversations: any[] = data.conversations ?? [];
      const next: Record<string, string> = {};

      for (const conv of conversations) {
        const key = conv.contactId ?? conv.id ?? '';
        const stamp = conv.lastMessageAt ?? '';
        next[key] = stamp;
        const prev = prevMessageSnapshot[key];
        if (prev !== undefined && prev !== stamp && conv.unreadCount > 0) {
          dispatch('chat:new-message', {
            from: conv.contactId,
            fromName: conv.contactName,
            content: conv.lastMessage,
            timestamp: stamp,
          });
        }
      }
      prevMessageSnapshot = next;
    }
  } catch { /* network error */ }
}

function startPollingFallback() {
  if (pollingInterval) return;
  poll();
  pollingInterval = setInterval(poll, 5000);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, (e: Event) => void>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = getSocket();

    if (socket) {
      // Real Socket.IO mode
      const onConnect = () => setIsConnected(true);
      const onDisconnect = () => setIsConnected(false);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (socket.connected) setIsConnected(true);

      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      };
    } else {
      // Polling fallback — no socket server configured
      setIsConnected(true);
      startPollingFallback();
    }
  }, []);

  const emit = useCallback((event: keyof ClientToServerEvents, data: any) => {
    const socket = getSocket();
    if (socket && socketConnected) {
      socket.emit(event, data);
    }
  }, []);

  const on = useCallback((event: keyof ServerToClientEvents, callback: (data: any) => void) => {
    const windowEvent = EVENT_MAP[event];
    if (!windowEvent || typeof window === 'undefined') return;
    const wrapper = (e: Event) => callback((e as CustomEvent).detail);
    const key = `${event}:${callback.toString().slice(0, 40)}`;
    listenersRef.current.set(key, wrapper);
    window.addEventListener(windowEvent, wrapper);
  }, []);

  const off = useCallback((event: keyof ServerToClientEvents, callback?: (data: any) => void) => {
    const windowEvent = EVENT_MAP[event];
    if (!windowEvent || typeof window === 'undefined') return;

    if (callback) {
      const key = `${event}:${callback.toString().slice(0, 40)}`;
      const wrapper = listenersRef.current.get(key);
      if (wrapper) {
        window.removeEventListener(windowEvent, wrapper);
        listenersRef.current.delete(key);
      }
    } else {
      listenersRef.current.forEach((wrapper, key) => {
        if (key.startsWith(`${event}:`)) {
          window.removeEventListener(windowEvent, wrapper);
          listenersRef.current.delete(key);
        }
      });
    }
  }, []);

  return { isConnected, emit, on, off };
};

