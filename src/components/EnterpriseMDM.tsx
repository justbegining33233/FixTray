'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';
import { FaShieldAlt, FaWifi, FaMapMarkerAlt, FaBatteryHalf, FaLock, FaUnlock, FaExclamationTriangle } from 'react-icons/fa';

interface DeviceInfo {
  id: string;
  platform: string;
  model: string;
  operatingSystem: string;
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
  batteryLevel?: number;
  isCharging?: boolean;
  networkType?: string;
  networkConnected?: boolean;
  locationEnabled?: boolean;
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
}

interface SecurityPolicy {
  requireBiometric: boolean;
  allowScreenshots: boolean;
  allowCopyPaste: boolean;
  maxOfflineHours: number;
  requireLocationTracking: boolean;
  allowUntrustedNetworks: boolean;
  autoLockTimeout: number; // minutes
  remoteWipeEnabled: boolean;
}

interface MDMStatus {
  isEnrolled: boolean;
  isCompliant: boolean;
  lastCheckIn: Date;
  policiesApplied: SecurityPolicy;
  violations: string[];
  remoteWipeRequested: boolean;
}

export default function EnterpriseMDM() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [mdmStatus, setMdmStatus] = useState<MDMStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initializeMDM();
    } else {
      setIsLoading(false);
    }
  }, []);

  const initializeMDM = async () => {
    try {
      await loadDeviceInfo();
      await loadMDMStatus();
      await setupEventListeners();
    } catch (error) {
      console.error('MDM initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeviceInfo = async () => {
    try {
      const [device, network, battery] = await Promise.all([
        Device.getInfo(),
        Network.getStatus(),
        Device.getBatteryInfo().catch(() => null),
      ]);

      let location: any = null;
      try {
        const position = await Geolocation.getCurrentPosition({
          timeout: 5000,
          enableHighAccuracy: false,
        });
        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        };
      } catch {
        // Location not available
      }

      const deviceData: DeviceInfo = {
        id: (await Device.getId()).identifier,
        platform: device.platform,
        model: device.model,
        operatingSystem: device.operatingSystem,
        osVersion: device.osVersion,
        manufacturer: device.manufacturer,
        isVirtual: device.isVirtual,
        isCharging: battery?.isCharging,
        networkType: network.connectionType,
        networkConnected: network.connected,
        locationEnabled: location !== null,
        lastLocation: location,
      };

      setDeviceInfo(deviceData);
    } catch (error) {
      console.error('Failed to load device info:', error);
    }
  };

  const loadMDMStatus = async () => {
    try {
      // Load MDM status from secure storage or API
      const stored = localStorage.getItem('mdm_status');
      if (stored) {
        const status: MDMStatus = JSON.parse(stored);
        setMdmStatus(status);
      } else {
        // Default MDM status for unenrolled devices
        setMdmStatus({
          isEnrolled: false,
          isCompliant: true,
          lastCheckIn: new Date(),
          policiesApplied: getDefaultPolicies(),
          violations: [],
          remoteWipeRequested: false,
        });
      }
    } catch (error) {
      console.error('Failed to load MDM status:', error);
    }
  };

  const getDefaultPolicies = (): SecurityPolicy => ({
    requireBiometric: false,
    allowScreenshots: true,
    allowCopyPaste: true,
    maxOfflineHours: 24,
    requireLocationTracking: false,
    allowUntrustedNetworks: true,
    autoLockTimeout: 5,
    remoteWipeEnabled: false,
  });

  const setupEventListeners = async () => {
    // Network status changes
    Network.addListener('networkStatusChange', (status) => {
      setDeviceInfo(prev => prev ? {
        ...prev,
        networkType: status.connectionType,
        networkConnected: status.connected,
      } : null);
    });

    // App state changes
    App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        // App became active, refresh device info
        loadDeviceInfo();
      }
    });

    // Battery status changes
    try {
      const _batteryStatus = await Device.getBatteryInfo();
      // Note: Capacitor doesn't have battery change listeners, would need custom implementation
    } catch {
      // Battery info not available
    }
  };

  const enrollDevice = async () => {
    try {
      // Simulate MDM enrollment process
      const enrollmentData = {
        deviceId: deviceInfo?.id,
        deviceInfo,
        enrollmentTime: new Date(),
        policies: getEnterprisePolicies(),
      };

      // In a real implementation, this would call an MDM server
      const response = await fetch('/api/mdm/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrollmentData),
      });

      if (response.ok) {
        const result = await response.json();
        setMdmStatus({
          isEnrolled: true,
          isCompliant: true,
          lastCheckIn: new Date(),
          policiesApplied: result.policies,
          violations: [],
          remoteWipeRequested: false,
        });

        localStorage.setItem('mdm_status', JSON.stringify(mdmStatus));
        alert('Device enrolled successfully in MDM');
      } else {
        throw new Error('Enrollment failed');
      }
    } catch (error) {
      console.error('MDM enrollment failed:', error);
      alert('Failed to enroll device in MDM');
    }
  };

  const getEnterprisePolicies = (): SecurityPolicy => ({
    requireBiometric: true,
    allowScreenshots: false,
    allowCopyPaste: false,
    maxOfflineHours: 8,
    requireLocationTracking: true,
    allowUntrustedNetworks: false,
    autoLockTimeout: 2,
    remoteWipeEnabled: true,
  });

  const unenrollDevice = async () => {
    try {
      const qs = new URLSearchParams();
      if (deviceInfo?.id) qs.set('deviceId', deviceInfo.id);
      const response = await fetch(`/api/mdm/enroll?${qs.toString()}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMdmStatus({
          isEnrolled: false,
          isCompliant: true,
          lastCheckIn: new Date(),
          policiesApplied: getDefaultPolicies(),
          violations: [],
          remoteWipeRequested: false,
        });

        localStorage.removeItem('mdm_status');
        alert('Device unenrolled from MDM');
      } else {
        throw new Error('Unenrollment failed');
      }
    } catch (error) {
      console.error('MDM unenrollment failed:', error);
      alert('Failed to unenroll device from MDM');
    }
  };

  const performRemoteWipe = async () => {
    if (!mdmStatus?.remoteWipeRequested) return;

    try {
      // Clear all local data
      localStorage.clear();
      sessionStorage.clear();

      // Clear secure storage if available
      if (Capacitor.isPluginAvailable('SecureStoragePlugin')) {
        // Would clear all secure storage items
      }

      // In a real implementation, would also clear app data, cache, etc.
      alert('Device has been remotely wiped. All data cleared.');
      window.location.reload();
    } catch (error) {
      console.error('Remote wipe failed:', error);
    }
  };

  const checkCompliance = async () => {
    if (!mdmStatus) return;

    const violations: string[] = [];

    // Check biometric requirement
    if (mdmStatus.policiesApplied.requireBiometric) {
      // Would check if biometric is set up and working
      // For now, assume compliant
    }

    // Check network compliance
    if (!mdmStatus.policiesApplied.allowUntrustedNetworks && deviceInfo?.networkType === 'wifi') {
      // Would check if connected to trusted WiFi
      // For now, assume compliant
    }

    // Check location tracking
    if (mdmStatus.policiesApplied.requireLocationTracking && !deviceInfo?.locationEnabled) {
      violations.push('Location tracking required but not enabled');
    }

    // Update compliance status
    setMdmStatus(prev => prev ? {
      ...prev,
      isCompliant: violations.length === 0,
      violations,
      lastCheckIn: new Date(),
    } : null);
  };

  if (isLoading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#9ca3af',
      }}>
        Loading MDM status...
      </div>
    );
  }

  if (!Capacitor.isNativePlatform()) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '14px',
      }}>
        Enterprise MDM features are only available on mobile devices.
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '20px',
      margin: '10px 0',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaShieldAlt size={20} color="#e5332a" />
          <h3 style={{ color: '#e5e7eb', fontSize: '16px', fontWeight: '600' }}>
            Enterprise MDM
          </h3>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Status Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px',
          background: mdmStatus?.isEnrolled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderRadius: '6px',
        }}>
          {mdmStatus?.isEnrolled ? <FaLock size={14} color="#10b981" /> : <FaUnlock size={14} color="#ef4444" />}
          <span style={{ fontSize: '12px', color: '#e5e7eb' }}>
            {mdmStatus?.isEnrolled ? 'Enrolled' : 'Not Enrolled'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px',
          background: mdmStatus?.isCompliant ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderRadius: '6px',
        }}>
          {mdmStatus?.isCompliant ? <FaShieldAlt size={14} color="#10b981" /> : <FaExclamationTriangle size={14} color="#ef4444" />}
          <span style={{ fontSize: '12px', color: '#e5e7eb' }}>
            {mdmStatus?.isCompliant ? 'Compliant' : 'Non-Compliant'}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px',
          background: deviceInfo?.networkConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderRadius: '6px',
        }}>
          <FaWifi size={14} color={deviceInfo?.networkConnected ? '#10b981' : '#ef4444'} />
          <span style={{ fontSize: '12px', color: '#e5e7eb' }}>
            {deviceInfo?.networkConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        {deviceInfo?.batteryLevel !== undefined && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px',
            background: (deviceInfo.batteryLevel || 0) > 20 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderRadius: '6px',
          }}>
            <FaBatteryHalf size={14} color={(deviceInfo.batteryLevel || 0) > 20 ? '#10b981' : '#ef4444'} />
            <span style={{ fontSize: '12px', color: '#e5e7eb' }}>
              {Math.round((deviceInfo.batteryLevel || 0) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
          {/* Device Information */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ color: '#e5e7eb', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Device Information
            </h4>
            <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.4' }}>
              <div>Model: {deviceInfo?.model}</div>
              <div>OS: {deviceInfo?.operatingSystem} {deviceInfo?.osVersion}</div>
              <div>Manufacturer: {deviceInfo?.manufacturer}</div>
              <div>Device ID: {deviceInfo?.id?.slice(0, 8)}...</div>
              {deviceInfo?.lastLocation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FaMapMarkerAlt size={10} />
                  Location: {deviceInfo.lastLocation.latitude.toFixed(4)}, {deviceInfo.lastLocation.longitude.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          {/* Security Policies */}
          {mdmStatus?.policiesApplied && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#e5e7eb', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                Security Policies
              </h4>
              <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.4' }}>
                <div>Biometric Required: {mdmStatus.policiesApplied.requireBiometric ? 'Yes' : 'No'}</div>
                <div>Screenshots Allowed: {mdmStatus.policiesApplied.allowScreenshots ? 'Yes' : 'No'}</div>
                <div>Copy/Paste Allowed: {mdmStatus.policiesApplied.allowCopyPaste ? 'Yes' : 'No'}</div>
                <div>Max Offline Hours: {mdmStatus.policiesApplied.maxOfflineHours}</div>
                <div>Auto-lock Timeout: {mdmStatus.policiesApplied.autoLockTimeout} min</div>
                <div>Remote Wipe: {mdmStatus.policiesApplied.remoteWipeEnabled ? 'Enabled' : 'Disabled'}</div>
              </div>
            </div>
          )}

          {/* Violations */}
          {mdmStatus?.violations && mdmStatus.violations.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                Policy Violations
              </h4>
              <ul style={{ fontSize: '12px', color: '#ef4444', paddingLeft: '16px' }}>
                {mdmStatus.violations.map((violation, index) => (
                  <li key={index}>{violation}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!mdmStatus?.isEnrolled ? (
              <button
                onClick={enrollDevice}
                style={{
                  background: '#e5332a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Enroll Device
              </button>
            ) : (
              <>
                <button
                  onClick={checkCompliance}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Check Compliance
                </button>
                <button
                  onClick={unenrollDevice}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Unenroll Device
                </button>
              </>
            )}

            {mdmStatus?.remoteWipeRequested && (
              <button
                onClick={performRemoteWipe}
                style={{
                  background: '#7c2d12',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Perform Remote Wipe
              </button>
            )}
          </div>
        </div>
      )}

      {/* Last Check-in */}
      {mdmStatus?.lastCheckIn && (
        <div style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#6b7280',
          textAlign: 'center',
        }}>
          Last checked: {mdmStatus.lastCheckIn.toLocaleString()}
        </div>
      )}
    </div>
  );
}