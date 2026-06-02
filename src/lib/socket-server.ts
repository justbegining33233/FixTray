// Socket.io server configuration
import { Server as NetServer } from 'http';
import { NextApiResponse } from 'next';
import { Server as ServerIO, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

export type NextApiResponseServerIo = NextApiResponse & {
  socket: any & {
    server: NetServer & {
      io: ServerIO;
    };
  };
};

interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: string;
  shopId?: string;
  username?: string;
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.warn('WARNING: JWT_SECRET not set — socket auth will reject all tokens');
}

// Global variable to store the io instance
let io: ServerIO | null = null;

export const initSocketServer = (httpServer: any) => {
  if (io) return io; // Return existing instance

  io = new ServerIO(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : '*',
      methods: ['GET', 'POST'],
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      if (!jwtSecret) {
        return next(new Error('Server misconfigured'));
      }

      const decoded = jwt.verify(token, jwtSecret) as any;
      (socket as any).userId = decoded.id;
      (socket as any).role = decoded.role;
      (socket as any).shopId = decoded.shopId;
      socket.username = decoded.username;

      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {

    // Join user-specific room
    socket.join(`user_${socket.userId}`);

    // Join role-specific room
    if (socket.role) {
      socket.join(`role_${socket.role}`);
    }

    // Join shop-specific room
    if (socket.shopId) {
      socket.join(`shop_${socket.shopId}`);
    }

    // Handle work order updates
    socket.on('work-order-update', (data) => {
      // Broadcast to relevant users
      const { shopId, assignedTo } = data;

      // Notify shop admin
      if (shopId) {
        io?.to(`shop_${shopId}`).emit('work-order-updated', {
          ...data,
          updatedBy: socket.userId,
          timestamp: new Date().toISOString(),
        });
      }

      // Notify assigned technician
      if (assignedTo) {
        io?.to(`user_${assignedTo}`).emit('work-order-updated', {
          ...data,
          updatedBy: socket.userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle messaging
    socket.on('send-message', (data) => {
      const { receiverId, receiverRole } = data;

      const messageData = {
        ...data,
        senderId: socket.userId,
        senderRole: socket.role,
        timestamp: new Date().toISOString(),
      };

      // Send to specific receiver
      if (receiverId) {
        io?.to(`user_${receiverId}`).emit('new-message', messageData);
      }

      // Send to role-based receivers
      if (receiverRole) {
        io?.to(`role_${receiverRole}`).emit('new-message', messageData);
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      const { receiverId } = data;
      if (receiverId) {
        socket.to(`user_${receiverId}`).emit('user-typing', {
          from: socket.userId,
          fromName: socket.username,
        });
      }
    });

    socket.on('typing-stop', (data) => {
      const { receiverId } = data;
      if (receiverId) {
        socket.to(`user_${receiverId}`).emit('user-stopped-typing', {
          from: socket.userId,
        });
      }
    });

    // Handle location updates for technicians (emit to shop and specific customer when workOrderId provided)
    socket.on('location-update', async (data) => {
      if (socket.role === 'tech' && socket.shopId) {
        const payload = {
          techId: socket.userId,
          techName: socket.username,
          location: data,
          timestamp: new Date().toISOString(),
        };

        // Broadcast location to shop admins
        io?.to(`shop_${socket.shopId}`).emit('tech-location-updated', payload);

        // If we have a workOrderId, notify the specific customer for that work order
        try {
          if (data && data.workOrderId) {
            const workOrder = await prisma.workOrder.findUnique({ where: { id: data.workOrderId }, select: { customerId: true } });
            if (workOrder && workOrder.customerId) {
              io?.to(`user_${workOrder.customerId}`).emit('tech-location-updated', {
                ...payload,
                workOrderId: data.workOrderId,
              });
            }
          }
        } catch {
        }
      }
    });

    // Handle clock status changes
    socket.on('clock-status-change', (data) => {
      if (socket.shopId) {
        io?.to(`shop_${socket.shopId}`).emit('clock-status-changed', {
          userId: socket.userId,
          userName: socket.username,
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
    });
  });

  return io;
};

export const getSocketServer = () => io;
