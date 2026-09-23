'use client';
import { usePhrase } from '@/lib/usePhrase';
// StatusBadge.tsx - small pill status indicator for health signals
import React from 'react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  /** Display label for the badge */
  label: string;
  /** Visual tone */
  tone?: StatusTone;
  /** Optional compact size */
  size?: 'sm' | 'md';
  /** Optional pulsing dot animation */
  pulse?: boolean;
}

/**
 * Small status badge with colored dot and accessible label.
 */
export default function StatusBadge({ label, tone = 'info', size = 'md', pulse = false }: StatusBadgeProps) {
  const say = usePhrase();
  const palette: Record<StatusTone, { dot: string; bg: string; text: string; border: string }> = {
    success: { dot: 'bg-emerald-400', bg: 'bg-emerald-400/10', text: 'text-emerald-100', border: 'border-emerald-400/30' },
    warning: { dot: 'bg-amber-400', bg: 'bg-amber-400/10', text: 'text-amber-100', border: 'border-amber-400/30' },
    danger: { dot: 'bg-rose-400', bg: 'bg-rose-400/10', text: 'text-rose-100', border: 'border-rose-400/30' },
    info: { dot: 'bg-sky-400', bg: 'bg-sky-400/10', text: 'text-sky-100', border: 'border-sky-400/30' },
  };

  const sizing = size === 'sm'
    ? 'px-2 py-1 text-[11px]'
    : 'px-2.5 py-1.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border ${sizing} ${palette[tone].bg} ${palette[tone].text} ${palette[tone].border}`}
      aria-label={say(label)}
    >
      <span className={`w-2 h-2 rounded-full ${palette[tone].dot} ${pulse ? 'animate-pulse' : ''}`} aria-hidden />
      <span className="leading-none">{say(label)}</span>
    </span>
  );
}
