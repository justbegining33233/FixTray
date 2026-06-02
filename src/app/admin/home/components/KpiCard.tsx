// KpiCard.tsx - reusable KPI card with sparkline + delta
'use client';

import React from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import Sparkline from './Sparkline';

interface KpiCardProps {
  /** Label for the KPI */
  title: string;
  /** Main formatted value */
  value: string;
  /** Percentage or delta change text */
  change?: string;
  /** Sparkline data series */
  trend: number[];
  /** Accent color key */
  accent?: 'emerald' | 'sky' | 'violet' | 'amber';
  /** Optional supporting text */
  caption?: string;
}

/**
 * KPI card showing value, change, and a sparkline trend with enhanced glow effects.
 */
export default function KpiCard({ title, value, change, trend, accent = 'emerald', caption }: KpiCardProps) {
  const palette: Record<string, { ring: string; text: string; chip: string; chipText: string; shadow: string; color: string; glow: string }> = {
    emerald: { ring: 'border-[#e5332a]/30', text: 'text-[#ff6b64]', chip: 'bg-[#e5332a]/15', chipText: 'text-[#ff6b64]', shadow: 'shadow-[#e5332a]/20', color: '#e5332a', glow: 'shadow-[#e5332a]/50' },
    sky: { ring: 'border-[#1f2937]', text: 'text-zinc-100', chip: 'bg-white/5', chipText: 'text-zinc-200', shadow: 'shadow-black/20', color: '#e5332a', glow: 'shadow-[#e5332a]/50' },
    violet: { ring: 'border-[#1f2937]', text: 'text-zinc-100', chip: 'bg-white/5', chipText: 'text-zinc-200', shadow: 'shadow-black/20', color: '#ff6b64', glow: 'shadow-[#e5332a]/50' },
    amber: { ring: 'border-[#1f2937]', text: 'text-zinc-100', chip: 'bg-white/5', chipText: 'text-zinc-200', shadow: 'shadow-black/20', color: '#f87171', glow: 'shadow-[#e5332a]/50' },
  };

  const tone = palette[accent];

  return (
    <div className={`rounded-2xl border ${tone.ring} bg-gradient-to-br from-[#000000]/70 to-[#000000] p-4 shadow-lg ${tone.shadow} hover:${tone.glow} hover:scale-105 transition-all duration-300 group relative overflow-hidden`}>
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#e5332a]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400">{title}</p>
          <p className="text-2xl font-semibold text-white leading-tight mt-1 group-hover:text-[#ff6b64] transition-colors">{value}</p>
          {change && (
            <span className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs ${tone.chip} ${tone.chipText} group-hover:scale-110 transition-transform`}>
              <span aria-hidden><FaExternalLinkAlt style={{marginRight:4}} /></span>
              <span>{change}</span>
            </span>
          )}
          {caption && <p className="text-[11px] text-zinc-500 mt-2">{caption}</p>}
        </div>
        <div className="w-28 group-hover:scale-110 transition-transform">
          <Sparkline data={trend} color={tone.color} />
        </div>
      </div>
    </div>
  );
}

