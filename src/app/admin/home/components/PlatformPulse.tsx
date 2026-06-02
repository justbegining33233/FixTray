// PlatformPulse.tsx - hero pulse header with live status and sparklines
'use client';

import React from 'react';
import Sparkline from './Sparkline';
import StatusBadge, { StatusTone } from './StatusBadge';

interface PulseMetric {
  label: string;
  value: string;
  change: string;
  trend: number[];
  tone?: StatusTone;
}

interface PlatformPulseProps {
  /** API status label */
  apiStatus: string;
  /** Uptime percentage */
  uptime: number;
  /** Latency in ms */
  latencyMs: number;
  /** Metrics to showcase */
  metrics: PulseMetric[];
}

/**
 * Dramatic hero showing platform health and quick trending metrics with enhanced visuals.
 */
export default function PlatformPulse({ apiStatus, uptime, latencyMs, metrics }: PlatformPulseProps) {
  return (
    <section className="rounded-3xl border border-[#1f2937]/70 bg-gradient-to-br from-[#000000] via-[#000000] to-[#111111] p-6 shadow-2xl shadow-black/50 relative overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#e5332a]/5 via-transparent to-emerald-500/5 animate-pulse" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#e5332a] via-zinc-400 to-emerald-500" />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#e5332a] animate-pulse" />
            Platform Pulse
          </p>
          <h2 className="text-2xl lg:text-3xl font-semibold text-white leading-tight bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
            Live operational heartbeat
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl">
            API, infra, and business signals refreshed continuously so super admins see issues before users do.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <StatusBadge label={`${apiStatus} - ${uptime.toFixed(2)}% uptime`} tone="success" pulse />
            <StatusBadge label={`Latency ${latencyMs}ms`} tone={latencyMs > 350 ? 'warning' : 'success'} size="sm" />
            <StatusBadge label="Auto-refreshing" tone="info" size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 min-w-[260px]">
          {[{ label: 'API', tone: 'success' }, { label: 'DB', tone: 'info' }].map((chip) => (
            <div key={chip.label} className={`rounded-2xl border border-[#1f2937] bg-[#000000]/70 px-4 py-3 shadow-lg shadow-black/30 flex items-center justify-between hover:scale-105 transition-transform duration-300 ${chip.tone === 'success' ? 'hover:shadow-emerald-500/20' : 'hover:shadow-[#e5332a]/20'}`}>
              <div className="flex items-center gap-2 text-slate-200 text-sm">
                <span className={`w-2 h-2 rounded-full ${chip.tone === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'} shadow-lg`} />
                <span>{chip.label} status</span>
              </div>
              <span className="text-xs text-zinc-400">Realtime</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-[#1f2937]/70 bg-[#000000]/70 p-4 shadow-lg shadow-black/30 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">{metric.label}</p>
                <p className="text-lg font-semibold text-white mt-1 group-hover:text-[#ff6b64] transition-colors">{metric.value}</p>
              </div>
              <StatusBadge label={metric.change} tone={metric.tone || 'info'} size="sm" />
            </div>
            <div className="mt-3">
              <Sparkline data={metric.trend} color="#f97316" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

