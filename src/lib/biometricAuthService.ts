'use client';

import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { Device } from '@capacitor/device';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

interface BiometricCredentials {
  userId: string;
  userType: 'shop' | 'tech' | 'customer';
  deviceToken: string;
  timestamp: Date;
  deviceId: string;
  biometryType: BiometryType;
}

interface AuthResult {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
  requiresFallback?: boolean;
}

interface BiometricConfig {
  enabled: boolean;
  required: boolean;
  maxAttempts: number;
  lockoutDuration: number; // minutes
  allowFallback: boolean;
  autoPrompt: boolean;
}

export class BiometricAuthenticationService {
  private static instance: BiometricAuthenticationService;
  private config: BiometricConfig;
  private authAttempts: Map<string, number> = new Map();
  private lockouts: Map<string, Date> = new Map();

  private constructor() {
    this.config = {
      enabled: true,
      required: false,
      maxAttempts: 3,
      lockoutDuration: 15, // 15 minutes
      allowFallback: true,
      autoPrompt: true,
    };
  }

  static getInstance(): BiometricAuthenticationService {
    if (!BiometricAuthenticationService.instance) {
      BiometricAuthenticationService.instance = new BiometricAuthenticationService();
    }
    return BiometricAuthenticationService.instance;
  }

  // Initialize biometric authentication
  async initialize(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Biometric authentication not available: Not on native platform');
      return false;
    }

    try {
      const deviceInfo = await Device.getInfo();
      const biometryResult = await BiometricAuth.checkBiometry();

      console.log('Biometric initialization:', {
        platform: deviceInfo.platform,
        isNative: Capacitor.isNativePlatform(),
        biometryAvailable: biometryResult.isAvailable,
        biometryType: biometryResult.biometryType,
      });

      return biometryResult.isAvailable;
    } catch (error) {
      console.error('Biometric initialization failed:', error);
      return false;
    }
  }

  // Configure biometric settings
  setConfig(config: Partial<BiometricConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Check if biometric authentication is available
  async isAvailable(): Promise<{
    available: boolean;
    type: BiometryType;
    enrolled: boolean;
  }> {
    try {
      const result = await BiometricAuth.checkBiometry();
      return {
        available: result.isAvailable,
        type: result.biometryType,
        enrolled: result.biometryType !== BiometryType.none,
      };
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return {
        available: false,
        type: BiometryType.none,
        enrolled: false,
      };
    }
  }

  // Authenticate using biometrics
  async authenticate(reason?: string): Promise<AuthResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Biometric authentication is disabled',
        requiresFallback: true,
      };
    }

    const availability = await this.isAvailable();
    if (!availability.available) {
      return {
        success: false,
        error: 'Biometric authentication not available',
        requiresFallback: this.config.allowFallback,
      };
    }

    // Check for lockout
    const deviceId = await this.getDeviceId();
    if (this.isLockedOut(deviceId)) {
      const lockoutTime = this.lockouts.get(deviceId);
      const remainingMinutes = lockoutTime
        ? Math.ceil((lockoutTime.getTime() - Date.now()) / (1000 * 60))
        : 0;

      return {
        success: false,
        error: `Biometric authentication locked. Try again in ${remainingMinutes} minutes.`,
        requiresFallback: this.config.allowFallback,
      };
    }

    try {
      // authenticate() resolves on success, throws BiometryError on failure
      await BiometricAuth.authenticate({
        reason: reason || 'Please authenticate to access FixTray',
        cancelTitle: this.config.allowFallback ? 'Use Password' : 'Cancel',
        allowDeviceCredential: false,
      });

      // Success — reset attempts and perform login
      this.authAttempts.delete(deviceId);
      const credentials = await this.getStoredCredentials();
      if (credentials) {
        return await this.performBiometricLogin(credentials);
      }
      return { success: false, error: 'No stored credentials found', requiresFallback: true };
    } catch (error: unknown) {
      console.error('Biometric authentication error:', error);
      this.recordFailedAttempt(deviceId);

      const code = (error as { code?: string })?.code;
      switch (code) {
        case BiometryErrorType.biometryLockout:
          this.setLockout(deviceId);
          return { success: false, error: 'Biometric authentication is locked out. Please use password login.', requiresFallback: this.config.allowFallback };
        case BiometryErrorType.biometryNotEnrolled:
          return { success: false, error: 'No biometric credentials enrolled. Please set up biometrics in device settings.', requiresFallback: this.config.allowFallback };
        case BiometryErrorType.userCancel:
        case BiometryErrorType.appCancel:
          return { success: false, error: 'Authentication cancelled by user', requiresFallback: this.config.allowFallback };
        default:
          return { success: false, error: 'Authentication failed. Please try again.', requiresFallback: this.config.allowFallback };
      }
    }
  }

  /**
   * Register this device for biometric login.
   * Calls PUT /api/auth/biometric-login to obtain a server-issued device token,
   * then stores it securely on the device.
   */
  async storeCredentials(userId: string, userType: 'shop' | 'tech' | 'customer'): Promise<boolean> {
    try {
      const deviceId = await this.getDeviceId();
      const biometryInfo = await this.isAvailable();

      // Register with the server and receive a server-issued device token
      const response = await fetch('/api/auth/biometric-login', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userType,
          deviceId,
          deviceName: 'Mobile Device',
          biometryType: biometryInfo.type,
        }),
      });

      if (!response.ok) {
        console.error('Biometric registration failed:', await response.text());
        return false;
      }

      const { deviceToken, expiresAt } = await response.json();

      const credentials: BiometricCredentials = {
        userId,
        userType,
        deviceToken,
        timestamp: new Date(expiresAt),
        deviceId,
        biometryType: biometryInfo.type,
      };

      // Use secure storage if available, fallback to encrypted localStorage
      if (Capacitor.isPluginAvailable('SecureStoragePlugin')) {
        await SecureStoragePlugin.set({
          key: 'biometric_credentials',
          value: JSON.stringify(credentials),
        });
      } else {
        const encrypted = await this.encryptData(JSON.stringify(credentials));
        localStorage.setItem('biometric_credentials_encrypted', encrypted);
      }

      console.log('Biometric credentials stored securely');
      return true;
    } catch (error) {
      console.error('Failed to store biometric credentials:', error);
      return false;
    }
  }

  // Retrieve stored credentials
  private async getStoredCredentials(): Promise<BiometricCredentials | null> {
    try {
      let storedData: string | null = null;

      if (Capacitor.isPluginAvailable('SecureStoragePlugin')) {
        const result = await SecureStoragePlugin.get({ key: 'biometric_credentials' });
        storedData = result.value;
      } else {
        storedData = localStorage.getItem('biometric_credentials_encrypted');
        if (storedData) {
          storedData = await this.decryptData(storedData);
        }
      }

      if (!storedData) return null;

      const credentials: BiometricCredentials = JSON.parse(storedData);

      // Validate credentials haven't expired (timestamp stores server-issued expiresAt)
      if (new Date(credentials.timestamp).getTime() < Date.now()) {
        await this.clearCredentials();
        return null;
      }

      return credentials;
    } catch (error) {
      console.error('Failed to retrieve biometric credentials:', error);
      return null;
    }
  }

  // Clear stored credentials
  async clearCredentials(): Promise<void> {
    try {
      if (Capacitor.isPluginAvailable('SecureStoragePlugin')) {
        await SecureStoragePlugin.remove({ key: 'biometric_credentials' });
      } else {
        localStorage.removeItem('biometric_credentials_encrypted');
      }
      console.log('Biometric credentials cleared');
    } catch (error) {
      console.error('Failed to clear biometric credentials:', error);
    }
  }

  // Perform login with stored credentials
  private async performBiometricLogin(credentials: BiometricCredentials): Promise<AuthResult> {
    try {
      const response = await fetch('/api/auth/biometric-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: credentials.userId,
          deviceToken: credentials.deviceToken,
          deviceId: credentials.deviceId,
          biometryType: credentials.biometryType,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          token: result.token,
          user: result.user,
        };
      } else {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Biometric login failed',
          requiresFallback: true,
        };
      }
    } catch (error) {
      console.error('Biometric login request failed:', error);
      return {
        success: false,
        error: 'Network error during biometric login',
        requiresFallback: true,
      };
    }
  }

  // Check if device is locked out
  private isLockedOut(deviceId: string): boolean {
    const lockoutTime = this.lockouts.get(deviceId);
    if (!lockoutTime) return false;

    return Date.now() < lockoutTime.getTime();
  }

  // Set lockout for device
  private setLockout(deviceId: string): void {
    const lockoutTime = new Date(Date.now() + this.config.lockoutDuration * 60 * 1000);
    this.lockouts.set(deviceId, lockoutTime);
  }

  // Record failed authentication attempt
  private recordFailedAttempt(deviceId: string): void {
    const attempts = this.authAttempts.get(deviceId) || 0;
    this.authAttempts.set(deviceId, attempts + 1);

    if (attempts + 1 >= this.config.maxAttempts) {
      this.setLockout(deviceId);
    }
  }

  // Get unique device identifier
  private async getDeviceId(): Promise<string> {
    try {
      const deviceInfo = await Device.getId();
      return deviceInfo.identifier;
    } catch {
      // Fallback to a generated ID if device ID is not available
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  // Simple encryption/decryption for localStorage fallback
  private async encryptData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const key = await this.getEncryptionKey();

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) },
      key,
      dataBuffer
    );

    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(12 + encryptedArray.length);
    combined.set(new Uint8Array(encrypted.slice(0, 12))); // IV
    combined.set(encryptedArray, 12);

    return btoa(String.fromCharCode(...combined));
  }

  private async decryptData(encryptedData: string): Promise<string> {
    const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const key = await this.getEncryptionKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('FixTray_Biometric_Key_2024'),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('FixTray_Salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Get authentication statistics
  getAuthStats(deviceId?: string): {
    attempts: number;
    isLocked: boolean;
    lockoutRemaining?: number;
  } {
    const id = deviceId || 'unknown';
    const attempts = this.authAttempts.get(id) || 0;
    const isLocked = this.isLockedOut(id);
    const lockoutTime = this.lockouts.get(id);

    return {
      attempts,
      isLocked,
      lockoutRemaining: lockoutTime
        ? Math.max(0, Math.ceil((lockoutTime.getTime() - Date.now()) / (1000 * 60)))
        : undefined,
    };
  }

  // Reset authentication state (for testing or admin purposes)
  resetAuthState(deviceId?: string): void {
    const id = deviceId || 'unknown';
    this.authAttempts.delete(id);
    this.lockouts.delete(id);
  }
}

// Export singleton instance
export const biometricAuthService = BiometricAuthenticationService.getInstance();