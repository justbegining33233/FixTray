'use client';

import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { FaMapMarkerAlt, FaShareAlt, FaStop, FaPlay, FaClock } from 'react-icons/fa';

interface LocationTrackerProps {
  onLocationUpdate?: (position: Position) => void;
  onTrackingStart?: () => void;
  onTrackingStop?: () => void;
  autoStart?: boolean;
  updateInterval?: number; // in milliseconds
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export default function LocationTracker({
  onLocationUpdate,
  onTrackingStart,
  onTrackingStop,
  autoStart = false,
  updateInterval = 30000, // 30 seconds
}: LocationTrackerProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [trackingStartTime, setTrackingStartTime] = useState<number | null>(null);
  const [distanceTraveled, setDistanceTraveled] = useState<number>(0);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(() => Date.now());

  const watchIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Convert to meters
  };

  // Check location permissions
  const checkPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.checkPermissions();
        setPermissionStatus(permission.location === 'granted' ? 'granted' : 'denied');
        return permission.location === 'granted';
      } else {
        // For web, we'll check when requesting location
        setPermissionStatus('granted');
        return true;
      }
    } catch (_err) {
      setPermissionStatus('denied');
      return false;
    }
  };

  // Request permissions if needed
  const requestPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions();
        setPermissionStatus(permission.location === 'granted' ? 'granted' : 'denied');
        return permission.location === 'granted';
      }
      return true;
    } catch (_err) {
      setPermissionStatus('denied');
      return false;
    }
  };

  // Get current position
  const getCurrentPosition = async (): Promise<Position | null> => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });
      return position;
    } catch (_err: any) {
      setError(`Location error: ${_err.message}`);
      return null;
    }
  };

  // Start location tracking
  const startTracking = async () => {
    setError(null);

    // Check/request permissions
    let hasPermission = await checkPermissions();
    if (!hasPermission) {
      hasPermission = await requestPermissions();
    }

    if (!hasPermission) {
      setError('Location permission denied');
      return;
    }

    try {
      // Get initial position
      const initialPosition = await getCurrentPosition();
      if (!initialPosition) return;

      const locationData: LocationData = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
        accuracy: initialPosition.coords.accuracy,
        timestamp: initialPosition.timestamp,
        speed: initialPosition.coords.speed || undefined,
        heading: initialPosition.coords.heading || undefined,
      };

      setCurrentLocation(locationData);
      setLocationHistory([locationData]);
      setTrackingStartTime(Date.now());
      setIsTracking(true);

      if (onTrackingStart) onTrackingStart();
      if (onLocationUpdate) onLocationUpdate(initialPosition);

      // Start watching position
      if (Capacitor.isNativePlatform()) {
        watchIdRef.current = await Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }, (position, err) => {
          if (err) {
            setError(`Watch error: ${err.message}`);
            return;
          }

          if (position) {
            const newLocation: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
            };

            setCurrentLocation(newLocation);
            setLocationHistory(prev => {
              const updated = [...prev, newLocation];

              // Calculate distance traveled
              if (prev.length > 0) {
                const lastLocation = prev[prev.length - 1];
                const distance = calculateDistance(
                  lastLocation.latitude, lastLocation.longitude,
                  newLocation.latitude, newLocation.longitude
                );
                setDistanceTraveled(current => current + distance);
              }

              // Keep only last 100 locations to prevent memory issues
              return updated.slice(-100);
            });

            if (onLocationUpdate) onLocationUpdate(position);
          }
        });
      } else {
        // Web fallback - use interval
        intervalRef.current = setInterval(async () => {
          const position = await getCurrentPosition();
          if (position) {
            const newLocation: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              speed: position.coords.speed || undefined,
              heading: position.coords.heading || undefined,
            };

            setCurrentLocation(newLocation);
            setLocationHistory(prev => {
              const updated = [...prev, newLocation];

              if (prev.length > 0) {
                const lastLocation = prev[prev.length - 1];
                const distance = calculateDistance(
                  lastLocation.latitude, lastLocation.longitude,
                  newLocation.latitude, newLocation.longitude
                );
                setDistanceTraveled(current => current + distance);
              }

              return updated.slice(-100);
            });

            if (onLocationUpdate) onLocationUpdate(position);
          }
        }, updateInterval);
      }
    } catch (err: any) {
      setError(`Failed to start tracking: ${err.message}`);
    }
  };

  // Stop location tracking
  const stopTracking = () => {
    if (watchIdRef.current) {
      Geolocation.clearWatch({ id: watchIdRef.current });
      watchIdRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsTracking(false);
    setTrackingStartTime(null);

    if (onTrackingStop) onTrackingStop();
  };

  // Share current location
  const shareLocation = async () => {
    if (!currentLocation) return;

    const locationUrl = `https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Location',
          text: 'Here is my current location',
          url: locationUrl,
        });
      } catch (_err: any) {
        // User cancelled share
      }
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(locationUrl);
      // You could show a toast notification here
    }
  };

  // Format time duration
  const formatDuration = (startTime: number): string => {
    const elapsed = currentTimestamp - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };

  useEffect(() => {
    checkPermissions();

    if (autoStart) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [autoStart]);

  useEffect(() => {
    if (!isTracking) return;

    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isTracking]);

  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '16px',
      margin: '8px 0',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaMapMarkerAlt style={{
            color: isTracking ? '#10b981' : '#6b7280',
            fontSize: '20px'
          }} />
          <h3 style={{
            color: '#e5e7eb',
            margin: 0,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Location Tracker
          </h3>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {permissionStatus === 'denied' && (
            <span style={{
              color: '#ef4444',
              fontSize: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '4px 8px',
              borderRadius: '4px',
            }}>
              Permission denied
            </span>
          )}

          <button
            onClick={isTracking ? stopTracking : startTracking}
            style={{
              padding: '8px 12px',
              background: isTracking ? '#ef4444' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isTracking ? <FaStop /> : <FaPlay />}
            {isTracking ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      {/* Current Location Info */}
      {currentLocation && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '12px',
          }}>
            <div style={{
              color: '#e5e7eb',
              fontSize: '14px',
              marginBottom: '4px',
              fontWeight: '500',
            }}>
              Current Location
            </div>
            <div style={{
              color: '#9ca3af',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}>
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </div>
            <div style={{
              color: '#6b7280',
              fontSize: '11px',
              marginTop: '4px',
            }}>
              Accuracy: ±{Math.round(currentLocation.accuracy)}m
              {currentLocation.speed && ` • Speed: ${Math.round(currentLocation.speed * 3.6)} km/h`}
            </div>
          </div>
        </div>
      )}

      {/* Tracking Stats */}
      {isTracking && trackingStartTime && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
            }}>
              <FaClock style={{ color: '#3b82f6', fontSize: '14px', marginBottom: '4px' }} />
              <div style={{ color: '#e5e7eb', fontSize: '12px', fontWeight: '500' }}>
                Duration
              </div>
              <div style={{ color: '#9ca3af', fontSize: '11px' }}>
                {formatDuration(trackingStartTime)}
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
            }}>
              <FaMapMarkerAlt style={{ color: '#10b981', fontSize: '14px', marginBottom: '4px' }} />
              <div style={{ color: '#e5e7eb', fontSize: '12px', fontWeight: '500' }}>
                Distance
              </div>
              <div style={{ color: '#9ca3af', fontSize: '11px' }}>
                {formatDistance(distanceTraveled)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
      }}>
        {currentLocation && (
          <button
            onClick={shareLocation}
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <FaShareAlt />
            Share Location
          </button>
        )}

        {locationHistory.length > 1 && (
          <button
            onClick={() => {
              // Export location data (could integrate with maps)
              const data = locationHistory.map(loc => ({
                lat: loc.latitude,
                lng: loc.longitude,
                time: new Date(loc.timestamp).toISOString(),
              }));
              console.log('Location history:', data);
              // In a real app, this could open a map or export GPX
            }}
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <FaMapMarkerAlt />
            View Route
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Status Indicator */}
      <div style={{
        marginTop: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isTracking ? '#10b981' : '#6b7280',
        }} />
        <span style={{
          color: '#9ca3af',
          fontSize: '12px',
        }}>
          {isTracking ? 'Tracking active' : 'Tracking inactive'}
        </span>
      </div>
    </div>
  );
}