import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  private isRealtimeEnabled(): boolean {
    return process.env.NEXT_PUBLIC_ENABLE_REALTIME === 'true';
  }

  private resolveSocketUrl(): string | null {
    if (!this.isRealtimeEnabled()) return null;
    // Require an explicit socket server URL — never fall back to window.location.origin.
    // The standalone socket-server.js must be deployed separately (Railway/Render/Fly.io)
    // and its URL set as NEXT_PUBLIC_SOCKET_URL.
    return process.env.NEXT_PUBLIC_SOCKET_URL || null;
  }

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Always use configured socket URL or same-origin to avoid cross-origin fallbacks.
    const socketUrl = this.resolveSocketUrl();
    if (!socketUrl) {
      return null;
    }

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 1,
      timeout: 10000,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (_reason) => {
      this.handleReconnect();
    });

    this.socket.on('connect_error', (_error) => {
      this.handleReconnect();
    });

    this.socket.on('connect_timeout', () => {
      this.handleReconnect();
    });

    // Server events (use canonical event names)
    this.socket.on('work-order-updated', (data) => {
      window.dispatchEvent(new CustomEvent('work-order:updated', { detail: data }));
    });

    this.socket.on('new-message', (data) => {
      window.dispatchEvent(new CustomEvent('chat:new-message', { detail: data }));
    });

    this.socket.on('user-typing', (data) => {
      window.dispatchEvent(new CustomEvent('chat:typing', { detail: data }));
    });

    this.socket.on('user-stopped-typing', (data) => {
      window.dispatchEvent(new CustomEvent('chat:stopped-typing', { detail: data }));
    });

    this.socket.on('tech-location-updated', (data) => {
      window.dispatchEvent(new CustomEvent('tech:location_updated', { detail: data }));
    });

    this.socket.on('clock-status-changed', (data) => {
      window.dispatchEvent(new CustomEvent('clock:status_changed', { detail: data }));
    });

    // Error handling
    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
      window.dispatchEvent(new CustomEvent('socket:error', { detail: data }));
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.socket?.connect();
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Work order methods
  updateWorkOrderStatus(workOrderId: string, status: string, updatedBy: string, shopId?: string) {
    this.socket?.emit('work-order-update', { workOrderId, status, updatedBy, shopId });
  }

  // Chat methods
  sendMessage(workOrderId: string, message: string, senderId: string, senderRole: string, receiverId?: string, receiverRole?: string) {
    this.socket?.emit('send-message', { workOrderId, message, senderId, senderRole, receiverId, receiverRole });
  }

  setTyping(workOrderId: string, isTyping: boolean, receiverId?: string) {
    this.socket?.emit(isTyping ? 'typing-start' : 'typing-stop', { workOrderId, receiverId });
  }

  // Location methods
  updateLocation(latitude: number, longitude: number, accuracy?: number) {
    this.socket?.emit('location-update', { latitude, longitude, accuracy });
  }

  // Location update for a specific work order (includes workOrderId so customers can receive only their assigned job updates)
  updateLocationForWorkOrder(workOrderId: string, latitude: number, longitude: number, accuracy?: number) {
    this.socket?.emit('location-update', { workOrderId, latitude, longitude, accuracy });
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const socketClient = new SocketClient();
export default socketClient;
