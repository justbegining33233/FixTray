'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaCamera, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
  label?: string;
}

export default function BarcodeScanner({ onScan, onClose, label = 'Scan a Barcode' }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

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
        // Detection error  -  continue scanning
      }
    }, 300);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
      startDetection(stream);
    } catch (err: any) {
      setError(err.message || 'Camera access denied. Please allow camera permissions.');
    }
  }

  useEffect(() => {
    const isSupportedAPI = 'BarcodeDetector' in window;
    setSupported(isSupportedAPI);

    if (isSupportedAPI) {
      startCamera();
    }

    return () => stopStream();
  }, []);

  function handleManualSubmit() {
    if (!manualCode.trim()) return;
    onScan(manualCode.trim());
    setManualCode('');
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 16, fontFamily: 'sans-serif',
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, border: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}><FaCamera style={{marginRight:4}} /> {label}</h2>
          <button aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {supported === false && (
          <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ color: '#fbbf24', fontSize: 14, margin: '0 0 8px', fontWeight: 600 }}><FaExclamationTriangle style={{marginRight:4}} /> Barcode scanning not supported in this browser</p>
            <p style={{ color: '#d4a017', fontSize: 13, margin: 0 }}>
              The BarcodeDetector API requires Chrome 83+, Edge 83+, or Chrome for Android. 
              Please enter the barcode manually below, or use a barcode scanner device.
            </p>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Video preview */}
        {supported !== false && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#0f172a', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
            {/* Scan crosshair overlay */}
            {scanning && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: '70%', height: '50%', border: '2px solid #3b82f6', borderRadius: 8, boxShadow: '0 0 0 4000px rgba(0,0,0,0.3)' }} />
              </div>
            )}
            {scanning && (
              <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', color: '#93c5fd', fontSize: 13 }}>
                Point camera at barcode...
              </div>
            )}
            {lastResult && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
                <div style={{ fontSize: 40 }}><FaCheckCircle style={{marginRight:4}} /></div>
                <div style={{ color: '#34d399', fontSize: 16, fontWeight: 700, marginTop: 8 }}>Scanned!</div>
                <div style={{ color: '#86efac', fontFamily: 'monospace', fontSize: 14, marginTop: 4 }}>{lastResult}</div>
              </div>
            )}
          </div>
        )}

        {/* Manual input fallback */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
          <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 10px' }}>Or enter barcode / SKU manually:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="e.g. 012345678905"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14 }}
            />
            <button onClick={handleManualSubmit} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Use
            </button>
          </div>
        </div>

        <button onClick={onClose} style={{ width: '100%', marginTop: 14, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
