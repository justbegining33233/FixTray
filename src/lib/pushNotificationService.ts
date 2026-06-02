'use client';

import { nativeMobileService, NotificationData } from './nativeMobileService';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: {
    workOrderId?: string;
    customerId?: string;
    type?: 'workorder' | 'message' | 'reminder' | 'system' | 'payment';
    actionUrl?: string;
  };
  sound?: string;
  badge?: number;
  priority?: 'normal' | 'high';
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  schedule: Date;
  data?: any;
  recurring?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
  };
}

class PushNotificationService {
  private pushToken: string | null = null;
  private notificationListeners: ((notification: any) => void)[] = [];
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Set up push notification listener
    nativeMobileService.onPushNotification = (notification) => {
      this.handleIncomingNotification(notification);
    };
  }

  // ===== PUSH NOTIFICATION MANAGEMENT =====

  async registerForPushNotifications(): Promise<string | null> {
    try {
      // The native service handles registration automatically
      // We just need to wait for the token
      return new Promise((resolve) => {
        const checkToken = () => {
          // This would need to be implemented in the native service
          // to expose the token
          setTimeout(() => {
            resolve(null); // Placeholder
          }, 1000);
        };
        checkToken();
      });
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          ...payload,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  async sendBulkPushNotification(
    userIds: string[],
    payload: PushNotificationPayload
  ): Promise<boolean> {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch('/api/push/send-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds,
          ...payload,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send bulk push notification:', error);
      return false;
    }
  }

  private handleIncomingNotification(notification: any) {
    // Trigger haptic feedback
    nativeMobileService.triggerNotificationHaptic();

    // Show local notification if app is in background
    if (document.hidden) {
      this.showLocalNotification({
        id: `push_${Date.now()}`,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });
    }

    // Notify all listeners
    this.notificationListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Notification listener error:', error);
      }
    });

    // Handle specific notification types
    this.handleNotificationAction(notification);
  }

  private handleNotificationAction(notification: any) {
    const { data } = notification;

    switch (data?.type) {
      case 'workorder':
        if (data.workOrderId) {
          // Navigate to work order
          setTimeout(() => {
            window.location.href = `/customer/workorders/${data.workOrderId}`;
          }, 1000);
        }
        break;

      case 'message':
        if (data.customerId) {
          // Navigate to messages
          setTimeout(() => {
            window.location.href = '/customer/messages';
          }, 1000);
        }
        break;

      case 'reminder':
        // Show reminder modal or navigate to relevant page
        break;

      default:
        // Handle custom action URL
        if (data?.actionUrl) {
          setTimeout(() => {
            window.location.href = data.actionUrl;
          }, 1000);
        }
    }
  }

  // ===== LOCAL NOTIFICATIONS =====

  async showLocalNotification(notification: NotificationData): Promise<void> {
    await nativeMobileService.scheduleNotification(notification);
  }

  async scheduleLocalNotification(notification: ScheduledNotification): Promise<void> {
    this.scheduledNotifications.set(notification.id, notification);

    await nativeMobileService.scheduleNotification({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      schedule: notification.schedule,
      data: notification.data,
    });

    // Handle recurring notifications
    if (notification.recurring) {
      this.scheduleRecurringNotification(notification);
    }
  }

  private scheduleRecurringNotification(notification: ScheduledNotification): void {
    if (!notification.recurring) return;

    const { type, interval } = notification.recurring;
    const nextSchedule = new Date(notification.schedule);

    switch (type) {
      case 'daily':
        nextSchedule.setDate(nextSchedule.getDate() + interval);
        break;
      case 'weekly':
        nextSchedule.setDate(nextSchedule.getDate() + (interval * 7));
        break;
      case 'monthly':
        nextSchedule.setMonth(nextSchedule.getMonth() + interval);
        break;
    }

    const recurringNotification: ScheduledNotification = {
      ...notification,
      id: `${notification.id}_recurring_${Date.now()}`,
      schedule: nextSchedule,
      recurring: notification.recurring,
    };

    // Schedule the next occurrence
    setTimeout(() => {
      this.scheduleLocalNotification(recurringNotification);
    }, nextSchedule.getTime() - Date.now());
  }

  async cancelScheduledNotification(notificationId: string): Promise<void> {
    await nativeMobileService.cancelNotification(notificationId);
    this.scheduledNotifications.delete(notificationId);
  }

  async cancelAllScheduledNotifications(): Promise<void> {
    for (const [id] of this.scheduledNotifications) {
      await this.cancelScheduledNotification(id);
    }
    this.scheduledNotifications.clear();
  }

  // ===== WORK ORDER NOTIFICATIONS =====

  async notifyWorkOrderAssigned(technicianId: string, workOrderId: string, workOrderTitle: string): Promise<void> {
    await this.sendPushNotification(technicianId, {
      title: 'New Work Order Assigned',
      body: `You have been assigned: ${workOrderTitle}`,
      data: {
        workOrderId,
        type: 'workorder',
        actionUrl: `/tech/home`,
      },
      priority: 'high',
    });
  }

  async notifyWorkOrderUpdated(customerId: string, workOrderId: string, status: string): Promise<void> {
    await this.sendPushNotification(customerId, {
      title: 'Work Order Updated',
      body: `Your work order status has been updated to: ${status}`,
      data: {
        workOrderId,
        type: 'workorder',
        actionUrl: `/customer/workorders/${workOrderId}`,
      },
    });
  }

  async notifyWorkOrderCompleted(customerId: string, workOrderId: string): Promise<void> {
    await this.sendPushNotification(customerId, {
      title: 'Work Order Completed',
      body: 'Your work order has been completed. Please review and approve.',
      data: {
        workOrderId,
        type: 'workorder',
        actionUrl: `/customer/workorders/${workOrderId}`,
      },
      priority: 'high',
    });
  }

  // ===== APPOINTMENT REMINDERS =====

  async scheduleAppointmentReminder(
    userId: string,
    appointmentId: string,
    title: string,
    appointmentTime: Date,
    reminderMinutes: number = 60
  ): Promise<void> {
    const reminderTime = new Date(appointmentTime.getTime() - (reminderMinutes * 60 * 1000));

    if (reminderTime <= new Date()) return; // Don't schedule past reminders

    await this.scheduleLocalNotification({
      id: `appointment_${appointmentId}`,
      title: 'Appointment Reminder',
      body: `${title} in ${reminderMinutes} minutes`,
      schedule: reminderTime,
      data: {
        appointmentId,
        type: 'reminder',
        actionUrl: '/appointments',
      },
    });
  }

  // ===== MESSAGE NOTIFICATIONS =====

  async notifyNewMessage(recipientId: string, senderName: string, messagePreview: string): Promise<void> {
    await this.sendPushNotification(recipientId, {
      title: `New Message from ${senderName}`,
      body: messagePreview,
      data: {
        type: 'message',
        actionUrl: '/customer/messages',
      },
    });
  }

  // ===== SYSTEM NOTIFICATIONS =====

  async notifySystemMaintenance(message: string, scheduledTime?: Date): Promise<void> {
    // Get all users (this would need to be implemented on the backend)
    // For now, this is a placeholder
    console.log('System maintenance notification:', message, scheduledTime);
  }

  async notifyPaymentReminder(customerId: string, amount: number, dueDate: Date): Promise<void> {
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await this.sendPushNotification(customerId, {
      title: 'Payment Reminder',
      body: `Payment of $${amount.toFixed(2)} is due in ${daysUntilDue} days`,
      data: {
        type: 'payment',
        actionUrl: '/payments',
      },
      priority: daysUntilDue <= 1 ? 'high' : 'normal',
    });
  }

  // ===== EVENT LISTENERS =====

  addNotificationListener(callback: (notification: any) => void): () => void {
    this.notificationListeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.notificationListeners.indexOf(callback);
      if (index > -1) {
        this.notificationListeners.splice(index, 1);
      }
    };
  }

  // ===== NOTIFICATION SETTINGS =====

  async updateNotificationSettings(settings: {
    workOrders?: boolean;
    messages?: boolean;
    reminders?: boolean;
    system?: boolean;
    sound?: boolean;
    vibration?: boolean;
  }): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/user/notification-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      // Store locally as well
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  }

  getNotificationSettings(): any {
    try {
      const stored = localStorage.getItem('notificationSettings');
      return stored ? JSON.parse(stored) : {
        workOrders: true,
        messages: true,
        reminders: true,
        system: true,
        sound: true,
        vibration: true,
      };
    } catch {
      return {
        workOrders: true,
        messages: true,
        reminders: true,
        system: true,
        sound: true,
        vibration: true,
      };
    }
  }

  // ===== CLEANUP =====

  async clearAllNotifications(): Promise<void> {
    await this.cancelAllScheduledNotifications();
    this.notificationListeners = [];
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;