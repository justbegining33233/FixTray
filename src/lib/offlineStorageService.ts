'use client';

import { nativeMobileService, OfflineWorkOrder, PhotoData, LocationData } from './nativeMobileService';

export interface OfflineQueueItem {
  id: string;
  type: 'workorder' | 'photo' | 'location' | 'note';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number | null;
  pendingItems: number;
  failedItems: number;
}

class OfflineStorageService {
  private queue: OfflineQueueItem[] = [];
  private isInitialized = false;
  private syncInProgress = false;
  private syncStatus: SyncStatus = {
    isOnline: true,
    lastSyncTime: null,
    pendingItems: 0,
    failedItems: 0,
  };

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.isInitialized) return;

    try {
      // Load existing queue from storage
      await this.loadQueueFromStorage();

      // Set up network change listener
      nativeMobileService.onNetworkChange = (status) => {
        this.syncStatus.isOnline = status.connected;
        if (status.connected) {
          this.syncPendingItems();
        }
      };

      // Initial sync check
      this.syncStatus.isOnline = nativeMobileService.isOnline();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
    }
  }

  // ===== QUEUE MANAGEMENT =====

  async addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): Promise<void> {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.queue.push(queueItem);
    this.syncStatus.pendingItems = this.queue.length;

    await this.saveQueueToStorage();

    // Try to sync immediately if online
    if (this.syncStatus.isOnline) {
      this.syncPendingItems();
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;

      const stored = localStorage.getItem('offline_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
        this.syncStatus.pendingItems = this.queue.length;
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
    }
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;

      localStorage.setItem('offline_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  // ===== SYNC OPERATIONS =====

  async syncPendingItems(): Promise<void> {
    if (this.syncInProgress || !this.syncStatus.isOnline) return;

    this.syncInProgress = true;

    try {
      const itemsToSync = [...this.queue];
      const successfulItems: string[] = [];
      const failedItems: OfflineQueueItem[] = [];

      for (const item of itemsToSync) {
        try {
          await this.syncItem(item);
          successfulItems.push(item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);

          item.retryCount++;
          if (item.retryCount >= item.maxRetries) {
            failedItems.push(item);
            successfulItems.push(item.id); // Remove from queue
          }
        }
      }

      // Remove successful items from queue
      this.queue = this.queue.filter(item => !successfulItems.includes(item.id));

      // Update sync status
      this.syncStatus.lastSyncTime = Date.now();
      this.syncStatus.pendingItems = this.queue.length;
      this.syncStatus.failedItems = failedItems.length;

      await this.saveQueueToStorage();

      // Trigger haptic feedback for sync completion
      if (successfulItems.length > 0) {
        await nativeMobileService.triggerHapticFeedback();
      }

    } catch (error) {
      console.error('Sync operation failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: OfflineQueueItem): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No authentication token');

    switch (item.type) {
      case 'workorder':
        await this.syncWorkOrder(item);
        break;
      case 'photo':
        await this.syncPhoto(item);
        break;
      case 'location':
        await this.syncLocation(item);
        break;
      case 'note':
        await this.syncNote(item);
        break;
      default:
        throw new Error(`Unknown item type: ${item.type}`);
    }
  }

  private async syncWorkOrder(item: OfflineQueueItem): Promise<void> {
    const endpoint = item.action === 'create'
      ? '/api/workorders'
      : `/api/workorders/${item.data.id}`;

    const method = item.action === 'create' ? 'POST' :
                   item.action === 'update' ? 'PUT' : 'DELETE';

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: method !== 'DELETE' ? JSON.stringify(item.data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Work order sync failed: ${response.status}`);
    }
  }

  private async syncPhoto(item: OfflineQueueItem): Promise<void> {
    const formData = new FormData();
    formData.append('file', item.data.file);
    formData.append('workOrderId', item.data.workOrderId);
    formData.append('description', item.data.description || '');

    const response = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Photo sync failed: ${response.status}`);
    }
  }

  private async syncLocation(item: OfflineQueueItem): Promise<void> {
    const response = await fetch('/api/location/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(item.data),
    });

    if (!response.ok) {
      throw new Error(`Location sync failed: ${response.status}`);
    }
  }

  private async syncNote(item: OfflineQueueItem): Promise<void> {
    const response = await fetch(`/api/workorders/${item.data.workOrderId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        content: item.data.content,
        timestamp: item.data.timestamp,
      }),
    });

    if (!response.ok) {
      throw new Error(`Note sync failed: ${response.status}`);
    }
  }

  // ===== OFFLINE WORK ORDER MANAGEMENT =====

  async saveWorkOrderOffline(workOrder: Partial<OfflineWorkOrder>): Promise<void> {
    const offlineWorkOrder: OfflineWorkOrder = {
      id: workOrder.id || `offline_${Date.now()}`,
      title: workOrder.title || '',
      description: workOrder.description || '',
      status: workOrder.status || 'pending',
      photos: workOrder.photos || [],
      notes: workOrder.notes || '',
      location: workOrder.location,
      timestamp: Date.now(),
      synced: false,
    };

    await nativeMobileService.saveOfflineWorkOrder(offlineWorkOrder);

    // Add to sync queue
    await this.addToQueue({
      type: 'workorder',
      action: workOrder.id ? 'update' : 'create',
      data: offlineWorkOrder,
    });
  }

  async getOfflineWorkOrders(): Promise<OfflineWorkOrder[]> {
    return await nativeMobileService.getOfflineWorkOrders();
  }

  // ===== PHOTO MANAGEMENT =====

  async savePhotoOffline(photoData: PhotoData, workOrderId: string): Promise<void> {
    // Add to sync queue
    await this.addToQueue({
      type: 'photo',
      action: 'create',
      data: {
        file: photoData,
        workOrderId,
        description: `Photo taken ${new Date(photoData.timestamp).toLocaleString()}`,
      },
    });
  }

  // ===== LOCATION TRACKING =====

  async saveLocationOffline(locationData: LocationData, workOrderId?: string): Promise<void> {
    await this.addToQueue({
      type: 'location',
      action: 'create',
      data: {
        ...locationData,
        workOrderId,
      },
    });
  }

  // ===== NOTES =====

  async saveNoteOffline(content: string, workOrderId: string): Promise<void> {
    await this.addToQueue({
      type: 'note',
      action: 'create',
      data: {
        content,
        workOrderId,
        timestamp: Date.now(),
      },
    });
  }

  // ===== STATUS & MONITORING =====

  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getFailedItems(): OfflineQueueItem[] {
    return this.queue.filter(item => item.retryCount >= item.maxRetries);
  }

  async clearFailedItems(): Promise<void> {
    this.queue = this.queue.filter(item => item.retryCount < item.maxRetries);
    this.syncStatus.failedItems = 0;
    await this.saveQueueToStorage();
  }

  async forceSync(): Promise<void> {
    if (!this.syncStatus.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this.syncPendingItems();
  }

  // ===== BACKGROUND SYNC =====

  startBackgroundSync(intervalMinutes: number = 5): void {
    if (typeof window === 'undefined') return;

    const intervalMs = intervalMinutes * 60 * 1000;

    setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncInProgress) {
        this.syncPendingItems();
      }
    }, intervalMs);
  }

  // ===== CLEANUP =====

  async clearOldData(daysOld: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    // Clear old queue items
    this.queue = this.queue.filter(item => item.timestamp > cutoffTime);
    await this.saveQueueToStorage();

    // Clear old offline work orders
    const offlineWorkOrders = await this.getOfflineWorkOrders();
    const _recentWorkOrders = offlineWorkOrders.filter(wo => wo.timestamp > cutoffTime);

    // Note: This would need to be implemented in the native service
    // to actually remove old files from device storage
  }
}

// Export singleton instance
export const offlineStorageService = new OfflineStorageService();
export default offlineStorageService;