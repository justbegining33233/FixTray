// SystemHealth.tsx - infra health cards with animated statuses
'use client';

import React from 'react';
import StatusBadge, { StatusTone } from './StatusBadge';
import Sparkline from './Sparkline';

export interface HealthMetric {
  label: string;
  value: string;
  subtext: string;
  tone: StatusTone;
  trend: number[];
}

interface SystemHealthProps {
  metrics: HealthMetric[];
}

/**
 * Displays infra health metrics with subtle animation and sparklines, enhanced with glows.
 */
export default function SystemHealth({ metrics }: SystemHealthProps) {
  return (
    <section className="rounded-3xl border border-[#1f2937] bg-gradient-to-br from-[#000000] via-[#000000] to-[#111111] p-5 shadow-xl shadow-black/40 relative overflow-hidden group hover:shadow-2xl hover:shadow-[#e5332a]/20 transition-all duration-500">
      {/* Animated health glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#e5332a]/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10 flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400">System Health</p>
          <h3 className="text-lg font-semibold text-white">Infra heartbeat and latency</h3>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-[#1f2937] bg-[#000000]/70 p-4 shadow-lg shadow-black/30 hover:shadow-xl hover:scale-105 transition-all duration-300 group/metric flex flex-col gap-3">
            <p className="text-sm text-slate-200 font-semibold">{metric.label}</p>
            <p className="text-2xl font-semibold text-white leading-none group-hover/metric:text-[#ff6b64] transition-colors">{metric.value}</p>
            <div>
              <StatusBadge label={metric.subtext} tone={metric.tone} size="sm" />
            </div>
            <div className="h-12 group-hover/metric:scale-110 transition-transform">
              <Sparkline data={metric.trend} color={metric.tone === 'danger' ? '#f43f5e' : metric.tone === 'warning' ? '#fbbf24' : metric.tone === 'info' ? '#38bdf8' : '#22c55e'} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

