'use client';
import { usePhrase } from '@/lib/usePhrase';
// Sparkline.tsx - tiny trend visualization for KPI cards
import React from 'react';

interface SparklineProps {
  /** Numeric series to plot */
  data: number[];
  /** Stroke color */
  color?: string;
  /** Height in pixels */
  height?: number;
}

/**
 * Lightweight inline SVG sparkline for trend context.
 */
export default function Sparkline({ data, color = '#22c55e', height = 42 }: SparklineProps) {
  const say = usePhrase();
  if (!data || data.length === 0) {
    data = [0, 0];
  }
  const width = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={say("trend sparkline")} className="w-full select-none" style={{ height }}>
      <defs>
        <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon fill="url(#sparklineFill)" points={`0,${height} ${points} ${width},${height}`} />
    </svg>
  );
}
