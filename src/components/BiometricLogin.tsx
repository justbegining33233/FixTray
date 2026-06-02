'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { FaFingerprint, FaLock, FaCheckCircle, FaTimesCircle, FaShieldAlt } from 'react-icons/fa';

interface BiometricLoginProps {
  onSuccess: (credentials: { token: string; user: any }) => void;
  onError: (error: string) => void;
  onFallback: () => void;
  enabled?: boolean;
  requireBiometric?: boolean;
}

export default function BiometricLogin({
  onSuccess,
  onError,
  onFallback,
  enabled = true,
  requireBiometric = false,
}: BiometricLoginProps) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [biometryType, setBiometryType] = useState<BiometryType>(BiometryType.none);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lastAuthTime, setLastAuthTime] = useState<number | null>(null);
  const [authAttempts, setAuthAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) {
      setIsAvailable(false);
      return;
    }

    checkBiometricAvailability();
  }, [enabled]);

  const checkBiometricAvailability = async () => {
    try {
      const result = await BiometricAuth.checkBiometry();
      setIsAvailable(result.isAvailable);
      setBiometryType(result.biometryType);
      if (!result.isAvailable && requireBiometric) {
        onError('Biometric authentication is required but not available on this device');
      }
    } catch (error: unknown) {
      console.error('Biometric check failed:', error);
      setIsAvailable(false);
      if (requireBiometric) {
        onError('Biometric authentication is required but not supported');
      }
    }
  };

  const authenticateWithBiometrics = async () => {
    if (!isAvailable || isAuthenticating || isLocked) return;

    setIsAuthenticating(true);
    setAuthAttempts(prev => prev + 1);

    try {
      // authenticate() resolves on success, throws BiometryError on failure
      await BiometricAuth.authenticate({
        reason: 'Please authenticate to access FixTray',
        cancelTitle: 'Cancel',
        allowDeviceCredential: false,
      });

      setLastAuthTime(Date.now());
      setAuthAttempts(0);
      setIsLocked(false);
      await performBiometricLogin();
    } catch (error: unknown) {
      console.error('Biometric authentication failed:', error);
      const code = (error as { code?: string })?.code;

      if (code === BiometryErrorType.biometryLockout) {
        setIsLocked(true);
        onError('Biometric authentication is locked. Please use password login.');
      } else if (code === BiometryErrorType.biometryNotEnrolled) {
        onError('No biometric credentials enrolled. Please set up biometrics in your device settings.');
      } else if (code === BiometryErrorType.userCancel || code === BiometryErrorType.appCancel) {
        onFallback();
      } else {
        onError('Authentication failed. Please try again or use password login.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const performBiometricLogin = async () => {
    try {
      // Try to get stored credentials
      const storedCredentials = await getStoredCredentials();

      if (storedCredentials) {
        // Attempt login with stored credentials
        const response = await fetch('/api/auth/biometric-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: storedCredentials.userId,
            deviceToken: storedCredentials.deviceToken,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          onSuccess(result);
        } else {
          throw new Error('Stored credentials are invalid');
        }
      } else {
        // No stored credentials, trigger regular login
        onFallback();
      }
    } catch (error) {
      console.error('Biometric login failed:', error);
      onError('Biometric login failed. Please use password login.');
    }
  };

  const getStoredCredentials = async (): Promise<{ userId: string; deviceToken: string } | null> => {
    try {
      const stored = localStorage.getItem('biometric_credentials');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const getBiometryIcon = () => {
    switch (biometryType) {
      case BiometryType.touchId:
      case BiometryType.fingerprintAuthentication:
        return <FaFingerprint size={48} />;
      case BiometryType.faceId:
      case BiometryType.faceAuthentication:
      case BiometryType.irisAuthentication:
        return <FaShieldAlt size={48} />;
      default:
        return <FaLock size={48} />;
    }
  };

  const getBiometryLabel = () => {
    switch (biometryType) {
      case BiometryType.touchId:               return 'Touch ID';
      case BiometryType.faceId:                return 'Face ID';
      case BiometryType.fingerprintAuthentication: return 'Fingerprint';
      case BiometryType.faceAuthentication:    return 'Face Authentication';
      case BiometryType.irisAuthentication:    return 'Iris Authentication';
      default:                                 return 'Biometric Authentication';
    }
  };

  const shouldShowBiometricPrompt = () => {
    if (!enabled || !Capacitor.isNativePlatform() || !isAvailable) return false;

    // Show if required, or if user has recently logged in with password
    if (requireBiometric) return true;

    // Show if user has biometric credentials stored and it's been a while
    const stored = localStorage.getItem('biometric_credentials');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const hoursSinceLastUse = (Date.now() - data.timestamp) / (1000 * 60 * 60);
        return hoursSinceLastUse < 24; // Show within 24 hours of last use
      } catch {
        return false;
      }
    }

    return false;
  };

  if (!shouldShowBiometricPrompt()) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      backdropFilter: 'blur(10px)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '320px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Close button */}
        {!requireBiometric && (
          <button
            onClick={onFallback}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <FaTimesCircle />
          </button>
        )}

        {/* Biometric Icon */}
        <div style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: isAuthenticating
              ? 'rgba(229, 51, 42, 0.2)'
              : isLocked
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(16, 185, 129, 0.2)',
            border: `2px solid ${
              isAuthenticating
                ? '#e5332a'
                : isLocked
                  ? '#ef4444'
                  : '#10b981'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isAuthenticating
              ? '#e5332a'
              : isLocked
                ? '#ef4444'
                : '#10b981',
            animation: isAuthenticating ? 'pulse 1.5s infinite' : 'none',
          }}>
            {isLocked ? <FaTimesCircle size={32} /> : getBiometryIcon()}
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          color: '#e5e7eb',
          fontSize: '20px',
          fontWeight: '600',
          marginBottom: '8px',
        }}>
          {isLocked ? 'Authentication Locked' : 'Welcome Back'}
        </h2>

        {/* Subtitle */}
        <p style={{
          color: '#9ca3af',
          fontSize: '14px',
          marginBottom: '24px',
          lineHeight: '1.4',
        }}>
          {isLocked
            ? 'Too many failed attempts. Please use password login.'
            : `Use ${getBiometryLabel()} to quickly access FixTray`
          }
        </p>

        {/* Status Messages */}
        {isAuthenticating && (
          <div style={{
            color: '#e5332a',
            fontSize: '14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #e5332a',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            Authenticating...
          </div>
        )}

        {authAttempts > 0 && !isLocked && (
          <div style={{
            color: '#f59e0b',
            fontSize: '12px',
            marginBottom: '16px',
          }}>
            Attempt {authAttempts} of 3
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!isLocked && (
            <button
              onClick={authenticateWithBiometrics}
              disabled={isAuthenticating}
              style={{
                background: isAuthenticating ? '#374151' : '#e5332a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isAuthenticating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
              }}
            >
              {isAuthenticating ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid white',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Authenticating...
                </>
              ) : (
                <>
                  {getBiometryIcon()}
                  Use {getBiometryLabel()}
                </>
              )}
            </button>
          )}

          <button
            onClick={onFallback}
            style={{
              background: 'transparent',
              color: '#9ca3af',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {isLocked ? 'Use Password Login' : 'Use Password Instead'}
          </button>
        </div>

        {/* Success Indicator */}
        {lastAuthTime && !isAuthenticating && (
          <div style={{
            marginTop: '16px',
            color: '#10b981',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}>
            <FaCheckCircle />
            Authenticated {new Date(lastAuthTime).toLocaleTimeString()}
          </div>
        )}

        {/* Security Notice */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
        }}>
          <div style={{
            color: '#6b7280',
            fontSize: '11px',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
          }}>
            <FaShieldAlt size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
            Your biometric data is stored securely on your device and never shared with FixTray servers.
          </div>
        </div>
      </div>

      {/* Add styles for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Utility functions for managing biometric authentication
export const biometricAuth = {
  // Check if biometric auth is available and configured
  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const result = await BiometricAuth.checkBiometry();
      return result.isAvailable;
    } catch {
      return false;
    }
  },

  // Store user credentials for biometric login
  async storeCredentials(userId: string, deviceToken: string): Promise<void> {
    try {
      localStorage.setItem('biometric_credentials', JSON.stringify({
        userId,
        deviceToken,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to store biometric credentials:', error);
    }
  },

  // Clear stored biometric credentials
  clearCredentials(): void {
    localStorage.removeItem('biometric_credentials');
  },

  // Get stored credentials
  getCredentials(): { userId: string; deviceToken: string; timestamp: number } | null {
    try {
      const stored = localStorage.getItem('biometric_credentials');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  // Check if user should be prompted for biometric setup
  shouldPromptSetup(): boolean {
    const credentials = biometricAuth.getCredentials();
    if (!credentials) return false;

    // Prompt if credentials are older than 7 days
    const daysSinceSetup = (Date.now() - credentials.timestamp) / (1000 * 60 * 60 * 24);
    return daysSinceSetup > 7;
  },
};