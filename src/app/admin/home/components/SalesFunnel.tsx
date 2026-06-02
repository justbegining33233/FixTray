// SalesFunnel.tsx - visual funnel with drop percentages
'use client';

import React from 'react';
import { FaArrowRight } from 'react-icons/fa';
import StatusBadge from './StatusBadge';

interface SalesFunnelProps {
  /** Stage counts */
  visits: number;
  trials: number;
  members: number;
  customers: number;
}

/**
 * Displays a simple vertical funnel with drop-off percentages between stages, with enhanced animations.
 */
export default function SalesFunnel({ visits, trials, members, customers }: SalesFunnelProps) {
  const stages = [
    { label: 'Website Visits', value: visits, color: 'from-[#e5332a]/60 to-[#ff6b64]/20' },
    { label: 'Trials', value: trials, color: 'from-zinc-500/60 to-zinc-400/20' },
    { label: 'Members', value: members, color: 'from-[#e5332a]/60 to-[#ff6b64]/20' },
    { label: 'Customers', value: customers, color: 'from-emerald-500/60 to-emerald-400/20' },
  ];

  const pct = (num: number, den: number) => (den > 0 ? Math.max(Math.min((num / den) * 100, 100), 0) : num > 0 ? 100 : 0);

  const drops = [
    pct(trials, visits),
    pct(members, trials),
    pct(customers, members),
  ];

  return (
    <div className="rounded-2xl border border-[#1f2937] bg-gradient-to-b from-[#000000] via-[#000000] to-[#111111] p-5 shadow-lg shadow-black/30 relative overflow-hidden group hover:shadow-2xl hover:shadow-[#e5332a]/20 transition-all duration-500">
      {/* Animated funnel glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#e5332a]/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10 flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-400">Sales Funnel</p>
          <h3 className="text-lg font-semibold text-white">Website <FaArrowRight style={{marginRight:4}} /> Trials {'>'} Members {'>'} Customers</h3>
        </div>
        <StatusBadge label="Live" tone="success" pulse size="sm" />
      </div>

      <div className="relative z-10 space-y-5">
        {stages.map((stage, index) => (
          <div key={stage.label} className="space-y-2 group/stage hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span className="font-medium">{stage.label}</span>
              <span className="text-slate-300">{stage.value.toLocaleString()}</span>
            </div>
            <div className="h-3 rounded-full bg-zinc-800 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${stage.color} transition-all duration-700 shadow-lg`}
                style={{ width: `${pct(stage.value, index === 0 ? stage.value : stages[index - 1].value)}%` }}
              />
            </div>
            {index > 0 && (
              <p className="text-[11px] text-slate-500 group-hover/stage:text-orange-300 transition-colors">Conversion from previous: {drops[index - 1].toFixed(1)}%</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

