'use client';

import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation, PositionOptions } from '@capacitor/geolocation';
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';
import { Device, DeviceInfo } from '@capacitor/device';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHintALLOption, type CapacitorBarcodeScannerScanResult } from '@capacitor/barcode-scanner';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Motion, MotionEventResult } from '@capacitor/motion';

export interface PhotoData {
  webPath: string;
  base64Data: string;
  fileName: string;
  timestamp: number;
  latitude?: number;
  longitude?: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
  schedule?: Date;
}

export interface OfflineWorkOrder {
  id: string;
  title: string;
  description: string;
  status: string;
  photos: PhotoData[];
  notes: string;
  location?: LocationData;
  timestamp: number;
  synced: boolean;
}

class NativeMobileService {
  private isNative = Capacitor.isNativePlatform();
  private deviceInfo: DeviceInfo | null = null;
  private networkStatus: any = null;
  private locationWatchId: string | null = null;
  private motionWatchId: PluginListenerHandle | null = null;

  // Event callbacks
  onLocationUpdate?: (location: LocationData) => void;
  onNetworkChange?: (status: any) => void;
  onPushNotification?: (notification: PushNotificationSchema) => void;
  onMotionChange?: (motion: MotionEventResult) => void;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (!this.isNative) return;

    try {
      // Get device information
      this.deviceInfo = await Device.getInfo();

      // Initialize network monitoring
      this.networkStatus = await Network.getStatus();
      Network.addListener('networkStatusChange', (status) => {
        this.networkStatus = status;
        this.onNetworkChange?.(status);
      });

      // Initialize push notifications
      await this.initializePushNotifications();

      // Initialize local notifications
      await this.initializeLocalNotifications();

    } catch (error) {
      console.error('Failed to initialize native services:', error);
    }
  }

  // ===== CAMERA SERVICES =====

  async capturePhoto(options?: {
    quality?: number;
    width?: number;
    height?: number;
    includeLocation?: boolean;
  }): Promise<PhotoData | null> {
    if (!this.isNative) {
      throw new Error('Camera is only available on native platforms');
    }

    try {
      const image = await Camera.getPhoto({
        quality: options?.quality || 85,
        width: options?.width,
        height: options?.height,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        saveToGallery: false,
      });

      if (!image.base64String) return null;

      const photoData: PhotoData = {
        webPath: image.webPath || '',
        base64Data: image.base64String,
        fileName: `photo_${Date.now()}.jpg`,
        timestamp: Date.now(),
      };

      // Add location if requested
      if (options?.includeLocation) {
        try {
          const location = await this.getCurrentLocation();
          if (location) {
            photoData.latitude = location.latitude;
            photoData.longitude = location.longitude;
          }
        } catch (error) {
          console.warn('Could not get location for photo:', error);
        }
      }

      // Save to local storage
      await this.savePhotoToStorage(photoData);

      return photoData;
    } catch (error) {
      console.error('Photo capture failed:', error);
      throw error;
    }
  }

  async scanBarcode(): Promise<CapacitorBarcodeScannerScanResult | null> {
    if (!this.isNative) {
      throw new Error('Barcode scanner is only available on native platforms');
    }

    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHintALLOption.ALL });
      return result;
    } catch (error) {
      console.error('Barcode scan failed:', error);
      throw error;
    }
  }

  private async savePhotoToStorage(photoData: PhotoData): Promise<void> {
    if (!this.isNative) return;

    try {
      await Filesystem.writeFile({
        path: photoData.fileName,
        data: photoData.base64Data,
        directory: Directory.Data,
      });
    } catch (error) {
      console.error('Failed to save photo to storage:', error);
    }
  }

  // ===== LOCATION SERVICES =====

  async getCurrentLocation(options?: PositionOptions): Promise<LocationData | null> {
    if (!this.isNative) {
      throw new Error('Location services are only available on native platforms');
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        speed: position.coords.speed || undefined,
        heading: position.coords.heading || undefined,
      };
    } catch (error) {
      console.error('Location request failed:', error);
      throw error;
    }
  }

  async startLocationTracking(
    onLocationUpdate: (location: LocationData) => void,
    options?: { updateInterval?: number }
  ): Promise<void> {
    if (!this.isNative) return;

    this.onLocationUpdate = onLocationUpdate;

    try {
      this.locationWatchId = await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: options?.updateInterval || 30000,
      }, (position, error) => {
        if (error) {
          console.error('Location watch error:', error);
          return;
        }

        if (position && this.onLocationUpdate) {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
          };
          this.onLocationUpdate(locationData);
        }
      });
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      throw error;
    }
  }

  async stopLocationTracking(): Promise<void> {
    if (this.locationWatchId) {
      await Geolocation.clearWatch({ id: this.locationWatchId });
      this.locationWatchId = null;
    }
  }

  // ===== PUSH NOTIFICATION SERVICES =====

  private async initializePushNotifications(): Promise<void> {
    if (!this.isNative) return;

    try {
      // Request permission
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }

      // Register for push notifications
      await PushNotifications.register();

      // Add listeners
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token:', token.value);
        // Send token to server for push notifications
        this.sendPushTokenToServer(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration failed:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        this.onPushNotification?.(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action performed:', action);
        this.handlePushAction(action);
      });

    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  private async sendPushTokenToServer(token: string): Promise<void> {
    try {
      // Send token to your server for push notifications
      const response = await fetch('/api/push/register-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          token,
          platform: Capacitor.getPlatform(),
          deviceId: (this.deviceInfo as unknown as Record<string, unknown>)?.identifier ?? '',
        }),
      });

      if (!response.ok) {
        console.error('Failed to register push token with server');
      }
    } catch (error) {
      console.error('Error sending push token to server:', error);
    }
  }

  private handlePushAction(action: ActionPerformed): void {
    const { notification, actionId } = action;

    // Handle different action types
    switch (actionId) {
      case 'view':
        // Navigate to relevant page based on notification data
        if (notification.data?.workOrderId) {
          window.location.href = `/workorders/${notification.data.workOrderId}`;
        }
        break;
      case 'dismiss':
        // Just dismiss
        break;
      default:
        console.log('Unknown push action:', actionId);
    }
  }

  // ===== LOCAL NOTIFICATION SERVICES =====

  private async initializeLocalNotifications(): Promise<void> {
    if (!this.isNative) return;

    try {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        console.warn('Local notification permission denied');
        return;
      }
    } catch (error) {
      console.error('Failed to initialize local notifications:', error);
    }
  }

  async scheduleNotification(notification: NotificationData): Promise<void> {
    if (!this.isNative) return;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: parseInt(notification.id),
          title: notification.title,
          body: notification.body,
          extra: notification.data,
          schedule: notification.schedule ? { at: notification.schedule } : undefined,
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
        }],
      });
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    if (!this.isNative) return;

    try {
      await LocalNotifications.cancel({
        notifications: [{ id: parseInt(notificationId) }],
      });
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  // ===== OFFLINE STORAGE SERVICES =====

  async saveOfflineWorkOrder(workOrder: OfflineWorkOrder): Promise<void> {
    if (!this.isNative) return;

    try {
      const fileName = `workorder_${workOrder.id}.json`;
      const data = JSON.stringify(workOrder);

      await Filesystem.writeFile({
        path: fileName,
        data: btoa(data), // Base64 encode
        directory: Directory.Data,
      });
    } catch (error) {
      console.error('Failed to save offline work order:', error);
      throw error;
    }
  }

  async getOfflineWorkOrders(): Promise<OfflineWorkOrder[]> {
    if (!this.isNative) return [];

    try {
      const files = await Filesystem.readdir({
        path: '',
        directory: Directory.Data,
      });

      const workOrders: OfflineWorkOrder[] = [];

      for (const file of files.files) {
        if (file.name?.startsWith('workorder_') && file.name.endsWith('.json')) {
          try {
            const content = await Filesystem.readFile({
              path: file.name,
              directory: Directory.Data,
            });

            const data = JSON.parse(atob(content.data as string));
            workOrders.push(data);
          } catch (error) {
            console.warn('Failed to read work order file:', file.name, error);
          }
        }
      }

      return workOrders;
    } catch (error) {
      console.error('Failed to get offline work orders:', error);
      return [];
    }
  }

  async syncOfflineWorkOrders(): Promise<void> {
    if (!this.isNative || !this.networkStatus?.connected) return;

    try {
      const offlineWorkOrders = await this.getOfflineWorkOrders();

      for (const workOrder of offlineWorkOrders) {
        if (!workOrder.synced) {
          try {
            // Sync with server
            const response = await fetch(`/api/workorders/${workOrder.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({
                title: workOrder.title,
                description: workOrder.description,
                status: workOrder.status,
                notes: workOrder.notes,
                photos: workOrder.photos,
                location: workOrder.location,
              }),
            });

            if (response.ok) {
              // Mark as synced and update file
              workOrder.synced = true;
              await this.saveOfflineWorkOrder(workOrder);
            }
          } catch (error) {
            console.error('Failed to sync work order:', workOrder.id, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync offline work orders:', error);
    }
  }

  // ===== MOTION & HAPTICS SERVICES =====

  async startMotionTracking(onMotionChange: (motion: MotionEventResult) => void): Promise<void> {
    if (!this.isNative) return;

    this.onMotionChange = onMotionChange;

    try {
      this.motionWatchId = await Motion.addListener('accel', (event) => {
        this.onMotionChange?.(event);
      });
    } catch (error) {
      console.error('Failed to start motion tracking:', error);
    }
  }

  async stopMotionTracking(): Promise<void> {
    if (this.motionWatchId) {
      await this.motionWatchId.remove();
      this.motionWatchId = null;
    }
  }

  async triggerHapticFeedback(style: ImpactStyle = ImpactStyle.Medium): Promise<void> {
    if (!this.isNative) return;

    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.warn('Haptic feedback not supported:', error);
    }
  }

  async triggerNotificationHaptic(type: NotificationType = NotificationType.Success): Promise<void> {
    if (!this.isNative) return;

    try {
      await Haptics.notification({ type });
    } catch (error) {
      console.warn('Notification haptic not supported:', error);
    }
  }

  // ===== UTILITY METHODS =====

  isOnline(): boolean {
    return this.networkStatus?.connected ?? true;
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  getNetworkStatus(): any {
    return this.networkStatus;
  }

  // Cleanup method
  async destroy(): Promise<void> {
    await this.stopLocationTracking();
    await this.stopMotionTracking();

    if (this.isNative) {
      Network.removeAllListeners();
      PushNotifications.removeAllListeners();
    }
  }
}

// Export singleton instance
export const nativeMobileService = new NativeMobileService();
export default nativeMobileService;