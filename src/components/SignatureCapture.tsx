'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useRef, useState } from 'react';

interface SignatureCaptureProps {
  onChange: (signatureData: string | null) => void;
  tone?: 'light' | 'dark';
}

function paintPad(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, tone: 'light' | 'dark') {
  ctx.fillStyle = tone === 'dark' ? '#0b1220' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = tone === 'dark' ? '#e2e8f0' : '#111827';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

export default function SignatureCapture({ onChange, tone = 'light' }: SignatureCaptureProps) {
  const say = usePhrase();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const stroked = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const dark = tone === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintPad(ctx, canvas, tone);
  }, [tone]);

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
    paintPad(ctx, canvas, tone);
    stroked.current = false;
    setHasStroke(false);
    onChange(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={640}
        height={dark ? 120 : 180}
        aria-label={say("Signature")}
        style={{
          width: '100%',
          height: dark ? 72 : 140,
          background: dark ? '#0b1220' : '#fff',
          borderRadius: dark ? 10 : 8,
          border: dark ? '1px dashed rgba(255,255,255,0.22)' : 'none',
          touchAction: 'none',
          display: 'block',
          cursor: 'crosshair',
        }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      {dark && !hasStroke ? <span className="pm-sign-hint">{say('Sign here')}</span> : null}
      <div style={{ display: 'flex', justifyContent: dark ? 'flex-end' : 'space-between', marginTop: 6 }}>
        {dark ? null : (
          <span style={{ fontSize: 12, color: '#9aa3b2' }}>{hasStroke ? say("Signature captured") : say("Sign in the box")}</span>
        )}
        <button type="button" onClick={clear} style={{ background: 'transparent', color: '#9aa3b2', border: 'none', cursor: 'pointer', fontSize: 12 }}>
          {say("Clear")}{' '}</button>
      </div>
    </div>
  );
}
