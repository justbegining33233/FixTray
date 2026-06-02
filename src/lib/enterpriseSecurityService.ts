'use client';

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { biometricAuthService } from './biometricAuthService';

interface SecurityEvent {
  id: string;
  type: 'auth_attempt' | 'device_enrolled' | 'policy_violation' | 'remote_wipe' | 'jailbreak_detected' | 'suspicious_activity';
  timestamp: Date;
  deviceId: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  config: any;
}

interface DeviceSecurityStatus {
  isSecure: boolean;
  jailbreakDetected: boolean;
  lastSecurityCheck: Date;
  activePolicies: SecurityPolicy[];
  securityScore: number; // 0-100
  vulnerabilities: string[];
  recommendations: string[];
}

type SecurityEventListener = (event: SecurityEvent) => void;

export class EnterpriseSecurityService {
  private static instance: EnterpriseSecurityService;
  private securityEvents: SecurityEvent[] = [];
  private securityPolicies: SecurityPolicy[] = [];
  private deviceStatus: DeviceSecurityStatus | null = null;
  private eventListeners: Map<string, SecurityEventListener[]> = new Map();

  private constructor() {
    this.initializeDefaultPolicies();
    this.setupSecurityMonitoring();
  }

  static getInstance(): EnterpriseSecurityService {
    if (!EnterpriseSecurityService.instance) {
      EnterpriseSecurityService.instance = new EnterpriseSecurityService();
    }
    return EnterpriseSecurityService.instance;
  }

  // Initialize default security policies
  private initializeDefaultPolicies(): void {
    this.securityPolicies = [
      {
        id: 'biometric_required',
        name: 'Biometric Authentication Required',
        description: 'Require biometric authentication for app access',
        enabled: true,
        config: { maxAttempts: 3, lockoutDuration: 15 },
      },
      {
        id: 'device_encryption',
        name: 'Device Encryption Check',
        description: 'Ensure device has encryption enabled',
        enabled: true,
        config: {},
      },
      {
        id: 'jailbreak_detection',
        name: 'Jailbreak/Root Detection',
        description: 'Detect if device is jailbroken or rooted',
        enabled: true,
        config: {},
      },
      {
        id: 'network_security',
        name: 'Network Security',
        description: 'Monitor network connections for security',
        enabled: true,
        config: { allowUntrustedWifi: false },
      },
      {
        id: 'location_tracking',
        name: 'Location Tracking',
        description: 'Track device location for security monitoring',
        enabled: false,
        config: { required: false },
      },
      {
        id: 'remote_wipe',
        name: 'Remote Wipe Capability',
        description: 'Allow remote device wipe in case of loss/theft',
        enabled: true,
        config: {},
      },
      {
        id: 'screenshot_prevention',
        name: 'Screenshot Prevention',
        description: 'Prevent screenshots of sensitive content',
        enabled: false,
        config: {},
      },
      {
        id: 'offline_timeout',
        name: 'Offline Timeout',
        description: 'Maximum offline time before requiring re-authentication',
        enabled: true,
        config: { maxHours: 24 },
      },
    ];
  }

  // Setup security monitoring
  private setupSecurityMonitoring(): void {
    if (!Capacitor.isNativePlatform()) return;

    // Monitor app state changes
    App.addListener('appStateChange', (state) => {
      this.logSecurityEvent({
        type: state.isActive ? 'suspicious_activity' : 'auth_attempt',
        details: { action: state.isActive ? 'app_foreground' : 'app_background' },
        severity: 'low',
      });
    });

    // Monitor network changes
    Network.addListener('networkStatusChange', (status) => {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        details: {
          action: 'network_change',
          connected: status.connected,
          type: status.connectionType,
        },
        severity: status.connected ? 'low' : 'medium',
      });
    });

    // Periodic security checks
    setInterval(() => {
      this.performSecurityCheck();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Perform comprehensive security check
  async performSecurityCheck(): Promise<DeviceSecurityStatus> {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let securityScore = 100;

    try {
      // Check biometric availability
      const biometricAvailable = await biometricAuthService.isAvailable();
      if (!biometricAvailable.available) {
        vulnerabilities.push('Biometric authentication not available');
        securityScore -= 20;
        recommendations.push('Enable biometric authentication in device settings');
      }

      // Check device encryption (limited capability in Capacitor)
      const deviceInfo = await Device.getInfo();
      if (deviceInfo.platform === 'ios') {
        // iOS devices are always encrypted when passcode is set
        // This is a simplified check
      }

      // Check for jailbreak/root (basic detection)
      const jailbreakDetected = await this.detectJailbreak();
      if (jailbreakDetected) {
        vulnerabilities.push('Device appears to be jailbroken or rooted');
        securityScore -= 50;
        recommendations.push('Remove jailbreak/root access for security');
      }

      // Check network security
      const networkStatus = await Network.getStatus();
      if (networkStatus.connectionType === 'wifi' && !this.isTrustedNetwork()) {
        vulnerabilities.push('Connected to untrusted WiFi network');
        securityScore -= 15;
        recommendations.push('Connect to trusted networks only');
      }

      // Check location services if required
      const locationPolicy = this.securityPolicies.find(p => p.id === 'location_tracking');
      if (locationPolicy?.enabled && locationPolicy.config.required) {
        try {
          await Geolocation.getCurrentPosition({ timeout: 5000 });
        } catch {
          vulnerabilities.push('Location services required but not available');
          securityScore -= 10;
          recommendations.push('Enable location services');
        }
      }

      // Check offline timeout
      const offlinePolicy = this.securityPolicies.find(p => p.id === 'offline_timeout');
      if (offlinePolicy?.enabled) {
        const lastOnline = await this.getLastOnlineTime();
        const hoursOffline = (Date.now() - lastOnline) / (1000 * 60 * 60);
        if (hoursOffline > offlinePolicy.config.maxHours) {
          vulnerabilities.push(`Device offline for ${Math.round(hoursOffline)} hours (max: ${offlinePolicy.config.maxHours})`);
          securityScore -= 25;
          recommendations.push('Reconnect to network and re-authenticate');
        }
      }

      const status: DeviceSecurityStatus = {
        isSecure: securityScore >= 70,
        jailbreakDetected,
        lastSecurityCheck: new Date(),
        activePolicies: this.securityPolicies.filter(p => p.enabled),
        securityScore: Math.max(0, securityScore),
        vulnerabilities,
        recommendations,
      };

      this.deviceStatus = status;

      // Log security check
      this.logSecurityEvent({
        type: 'suspicious_activity',
        details: { action: 'security_check', score: securityScore },
        severity: securityScore < 50 ? 'high' : securityScore < 70 ? 'medium' : 'low',
      });

      return status;
    } catch (error) {
      console.error('Security check failed:', error);
      return {
        isSecure: false,
        jailbreakDetected: false,
        lastSecurityCheck: new Date(),
        activePolicies: [],
        securityScore: 0,
        vulnerabilities: ['Security check failed'],
        recommendations: ['Contact IT support'],
      };
    }
  }

  // Detect jailbreak/root (basic detection methods)
  private async detectJailbreak(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const deviceInfo = await Device.getInfo();

      if (deviceInfo.platform === 'ios') {
        // iOS jailbreak detection
        const suspiciousPaths = [
          '/Applications/Cydia.app',
          '/private/var/lib/apt',
          '/private/var/mobile/Library/SBSettings',
        ];

        for (const path of suspiciousPaths) {
          try {
            // This is a simplified check - in reality, would need native code
            if (await this.fileExists(path)) {
              return true;
            }
          } catch {
            // Continue checking
          }
        }
      } else if (deviceInfo.platform === 'android') {
        // Android root detection
        const rootIndicators = [
          '/system/xbin/su',
          '/system/bin/su',
          '/system/app/Superuser.apk',
        ];

        for (const path of rootIndicators) {
          try {
            if (await this.fileExists(path)) {
              return true;
            }
          } catch {
            // Continue checking
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  // Check if current network is trusted
  private async isTrustedNetwork(): Promise<boolean> {
    try {
      // In a real implementation, this would check against a list of trusted SSIDs
      // For now, assume all networks are trusted
      return true;
    } catch {
      return false;
    }
  }

  // Get last online time
  private async getLastOnlineTime(): Promise<number> {
    try {
      const stored = localStorage.getItem('last_online_time');
      return stored ? parseInt(stored) : Date.now();
    } catch {
      return Date.now();
    }
  }

  // Update last online time
  updateLastOnlineTime(): void {
    localStorage.setItem('last_online_time', Date.now().toString());
  }

  // File existence check (simplified)
  private async fileExists(_path: string): Promise<boolean> {
    // This would require native plugin implementation
    // For now, return false
    return false;
  }

  // Log security event
  logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'deviceId'>): void {
    const deviceId = 'unknown'; // Would get from Device.getId()

    const securityEvent: SecurityEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      deviceId,
      ...event,
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 100 events
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }

    // Notify listeners
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => listener(securityEvent));

    // Send to server if online
    this.sendEventToServer(securityEvent);
  }

  // Send security event to server
  private async sendEventToServer(event: SecurityEvent): Promise<void> {
    try {
      const networkStatus = await Network.getStatus();
      if (!networkStatus.connected) return;

      await fetch('/api/security/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to send security event:', error);
    }
  }

  // Add event listener
  addEventListener(eventType: SecurityEvent['type'], listener: SecurityEventListener): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(listener);
    this.eventListeners.set(eventType, listeners);
  }

  // Remove event listener
  removeEventListener(eventType: SecurityEvent['type'], listener: SecurityEventListener): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(eventType, listeners);
    }
  }

  // Get security events
  getSecurityEvents(limit = 50): SecurityEvent[] {
    return this.securityEvents.slice(-limit);
  }

  // Get device security status
  getDeviceSecurityStatus(): DeviceSecurityStatus | null {
    return this.deviceStatus;
  }

  // Update security policy
  updateSecurityPolicy(policyId: string, updates: Partial<SecurityPolicy>): void {
    const policyIndex = this.securityPolicies.findIndex(p => p.id === policyId);
    if (policyIndex > -1) {
      this.securityPolicies[policyIndex] = {
        ...this.securityPolicies[policyIndex],
        ...updates,
      };

      this.logSecurityEvent({
        type: 'policy_violation',
        details: { action: 'policy_updated', policyId, updates },
        severity: 'low',
      });
    }
  }

  // Get security policies
  getSecurityPolicies(): SecurityPolicy[] {
    return [...this.securityPolicies];
  }

  // Perform remote wipe
  async performRemoteWipe(reason: string): Promise<boolean> {
    try {
      this.logSecurityEvent({
        type: 'remote_wipe',
        details: { reason, initiated: 'remote' },
        severity: 'critical',
      });

      // Clear all local storage
      localStorage.clear();
      sessionStorage.clear();

      // Clear biometric credentials
      await biometricAuthService.clearCredentials();

      // In a real implementation, would also:
      // - Clear secure storage
      // - Clear app data
      // - Clear cache
      // - Revoke tokens
      // - Send confirmation to server

      return true;
    } catch (error) {
      console.error('Remote wipe failed:', error);
      return false;
    }
  }

  // Check if device meets security requirements
  async checkSecurityCompliance(): Promise<{
    compliant: boolean;
    issues: string[];
    score: number;
  }> {
    const status = await this.performSecurityCheck();

    return {
      compliant: status.isSecure,
      issues: status.vulnerabilities,
      score: status.securityScore,
    };
  }

  // Generate security report
  async generateSecurityReport(): Promise<any> {
    const status = await this.performSecurityCheck();
    const events = this.getSecurityEvents(100);

    return {
      deviceId: 'unknown', // Would get from Device.getId()
      timestamp: new Date(),
      securityStatus: status,
      recentEvents: events.slice(-20),
      policies: this.securityPolicies,
      recommendations: [
        ...status.recommendations,
        'Regularly update device OS',
        'Use strong passcodes',
        'Enable Find My Device',
        'Be cautious with app permissions',
      ],
    };
  }

  // Emergency security lockdown
  async emergencyLockdown(reason: string): Promise<void> {
    this.logSecurityEvent({
      type: 'suspicious_activity',
      details: { action: 'emergency_lockdown', reason },
      severity: 'critical',
    });

    // Disable all non-essential features
    this.securityPolicies.forEach(policy => {
      if (policy.id !== 'biometric_required' && policy.id !== 'remote_wipe') {
        policy.enabled = false;
      }
    });

    // Force re-authentication
    // In a real implementation, would force logout and re-auth
  }
}

// Export singleton instance
export const enterpriseSecurityService = EnterpriseSecurityService.getInstance();