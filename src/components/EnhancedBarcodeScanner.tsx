'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaCamera, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface EnhancedBarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
  onPhotoCapture?: (photoData: PhotoData) => void;
  label?: string;
  enablePhotoCapture?: boolean;
}

interface PhotoData {
  webPath: string;
  base64Data: string;
  fileName: string;
  timestamp: number;
}

export default function EnhancedBarcodeScanner({
  onScan,
  onClose,
  onPhotoCapture,
  label = 'Scan a Barcode',
  enablePhotoCapture = true
}: EnhancedBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [_supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<PhotoData[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Native camera photo capture
  const capturePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        saveToGallery: false,
      });

      if (image.base64String) {
        const photoData: PhotoData = {
          webPath: image.webPath || '',
          base64Data: image.base64String,
          fileName: `photo_${Date.now()}.jpg`,
          timestamp: Date.now(),
        };

        // Save to local storage for offline access
        if (Capacitor.isNativePlatform()) {
          await Filesystem.writeFile({
            path: photoData.fileName,
            data: image.base64String,
            directory: Directory.Data,
          });
        }

        setCapturedPhotos(prev => [...prev, photoData]);

        if (onPhotoCapture) {
          onPhotoCapture(photoData);
        }
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      setError('Failed to capture photo');
    }
  };

  // Enhanced barcode detection with native camera
  const startNativeScanning = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        saveToGallery: false,
      });

      if (image.base64String && 'BarcodeDetector' in window) {
        // Process the captured image for barcodes
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_8', 'ean_13', 'upc_a', 'upc_e', 'itf', 'codabar'],
        });

        // Create an image element from base64
        const img = new Image();
        img.src = `data:image/jpeg;base64,${image.base64String}`;

        img.onload = async () => {
          try {
            const barcodes = await detector.detect(img);
            if (barcodes.length > 0) {
              const value = barcodes[0].rawValue;
              setLastResult(value);
              setScanning(false);
              onScan(value);
            } else {
              setError('No barcode detected. Try again.');
            }
          } catch (_detectError) {
            setError('Barcode detection failed');
          }
        };
      }
    } catch (_error) {
      setError('Camera access failed');
    }
  };

  function startDetection(_stream: MediaStream) {
    if (!('BarcodeDetector' in window)) return;

    const detector = new (window as any).BarcodeDetector({
      formats: ['qr_code', 'code_128', 'code_39', 'ean_8', 'ean_13', 'upc_a', 'upc_e', 'itf', 'codabar'],
    });

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const value = barcodes[0].rawValue;
          stopStream();
          setLastResult(value);
          setScanning(false);
          onScan(value);
        }
      } catch {
        // Detection error - continue scanning
      }
    }, 500);
  }

  const startWebScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        startDetection(stream);
      }
    } catch (_err) {
      console.error('Camera access denied or unavailable');
    }
  };

  const startScanning = () => {
    setError(null);
    setLastResult(null);

    if (Capacitor.isNativePlatform()) {
      // Use native camera for better performance on mobile
      startNativeScanning();
    } else {
      // Fallback to web camera API
      startWebScanning();
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  useEffect(() => {
    // Check for barcode detection support
    if ('BarcodeDetector' in window) {
      setSupported(true);
    } else {
      setSupported(false);
    }

    return () => {
      stopStream();
    };
  }, [stopStream]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        background: '#020608',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{ color: '#e5e7eb', margin: 0, fontSize: '18px' }}>{label}</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#e5e7eb',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          ×
        </button>
      </div>

      {/* Camera View */}
      <div style={{ flex: 1, position: 'relative' }}>
        {scanning && !Capacitor.isNativePlatform() && (
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            playsInline
            muted
          />
        )}

        {scanning && Capacitor.isNativePlatform() && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#e5e7eb',
            fontSize: '16px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <FaCamera style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.7 }} />
              <p>Tap scan to open camera</p>
            </div>
          </div>
        )}

        {!scanning && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#e5e7eb',
          }}>
            <div style={{ textAlign: 'center' }}>
              <FaCamera style={{ fontSize: '64px', marginBottom: '24px', opacity: 0.5 }} />
              <p style={{ fontSize: '18px', marginBottom: '32px' }}>Ready to scan</p>
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {scanning && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '250px',
            height: '150px',
            border: '2px solid #e5332a',
            borderRadius: '8px',
            background: 'rgba(229, 51, 42, 0.1)',
          }}>
            <div style={{
              position: 'absolute',
              top: '-2px',
              left: '-2px',
              right: '-2px',
              bottom: '-2px',
              border: '2px solid transparent',
              borderTopColor: '#e5332a',
              borderRadius: '8px',
              animation: 'scan 2s linear infinite',
            }} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding: '16px',
        background: '#020608',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={startScanning}
            disabled={scanning}
            style={{
              flex: 1,
              padding: '12px',
              background: scanning ? '#374151' : '#e5332a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <FaCamera />
            {scanning ? 'Scanning...' : 'Scan'}
          </button>

          {enablePhotoCapture && (
            <button
              onClick={capturePhoto}
              style={{
                flex: 1,
                padding: '12px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <FaCamera />
              Photo
            </button>
          )}
        </div>

        {/* Manual Entry */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or enter code manually"
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#e5e7eb',
                fontSize: '16px',
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              style={{
                padding: '12px 16px',
                background: manualCode.trim() ? '#10b981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <FaCheckCircle />
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div style={{
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <FaExclamationTriangle />
            {error}
          </div>
        )}

        {lastResult && (
          <div style={{
            padding: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: '#a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <FaCheckCircle />
            Scanned: {lastResult}
          </div>
        )}

        {/* Captured Photos */}
        {capturedPhotos.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ color: '#e5e7eb', marginBottom: '8px' }}>Captured Photos ({capturedPhotos.length})</h4>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              {capturedPhotos.map((photo, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <img
                    src={`data:image/jpeg;base64,${photo.base64Data}`}
                    alt={`Captured ${index + 1}`}
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '2px solid rgba(255,255,255,0.2)',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#e5332a',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}>
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { clip-path: inset(0 0 100% 0); }
          50% { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(100% 0 0 0); }
        }
      `}</style>
    </div>
  );
}