'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useRef, useState } from 'react';

interface SignatureCaptureProps {
  onChange: (signatureData: string | null) => void;
}

export default function SignatureCapture({ onChange }: SignatureCaptureProps) {
  const say = usePhrase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const stroked = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const pointFrom = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const source = 'touches' in event ? event.touches[0] : event;
    return {
      x: ((source.clientX - rect.left) / rect.width) * canvas.width,
      y: ((source.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawing.current = true;
    const point = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const move = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const point = pointFrom(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    stroked.current = true;
    if (!hasStroke) setHasStroke(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && stroked.current) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    stroked.current = false;
    setHasStroke(false);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        aria-label={say("Signature")}
        style={{ width: '100%', height: 140, background: '#fff', borderRadius: 8, touchAction: 'none', display: 'block', cursor: 'crosshair' }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 12, color: '#9aa3b2' }}>{hasStroke ? say("Signature captured") : say("Sign in the box")}</span>
        <button type="button" onClick={clear} style={{ background: 'transparent', color: '#9aa3b2', border: 'none', cursor: 'pointer', fontSize: 12 }}>
          {say("Clear")}{' '}</button>
      </div>
    </div>
  );
}
