'use client';

import type { CSSProperties, ReactNode } from 'react';

export function money(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function hours(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(abs / 60)}h ${abs % 60}m`;
}

export const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #1a090b 0%, #12080a 100%)',
  color: '#f8ecea',
  padding: '16px 16px 48px',
  fontFamily: 'system-ui, sans-serif',
};

export const sectionCard: CSSProperties = {
  background: '#241014',
  border: '1px solid #4a1c22',
  borderRadius: 14,
  padding: 16,
  marginTop: 16,
};

export const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
  gap: 8,
};

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: '#241014', border: '1px solid #4a1c22', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ color: '#f0b4ae', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint ? <div style={{ color: '#c4a8a4', fontSize: 12, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

export function PeriodCard({
  title,
  subtitle,
  onClick,
  children,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: '#1c0d10',
        color: '#f8ecea',
        border: '1px solid #5c2428',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        <span style={{ color: '#e5332a', fontSize: 13, fontWeight: 700 }}>Open</span>
      </div>
      {subtitle ? <div style={{ color: '#e7c4bf', fontSize: 13, marginTop: 4 }}>{subtitle}</div> : null}
      <div style={{ marginTop: 10 }}>{children}</div>
    </button>
  );
}

export function Crumb({
  items,
}: {
  items: Array<{ id: string; label: string; onClick: () => void }>;
}) {
  return (
    <nav aria-label="Report period" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '12px 0 16px' }}>
      {items.map((item, index) => (
        <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {index > 0 ? <span aria-hidden="true" style={{ color: '#e5332a' }}>&gt;</span> : null}
          <button
            type="button"
            onClick={item.onClick}
            style={{
              background: index === items.length - 1 ? '#e5332a' : 'transparent',
              color: '#fff',
              border: '1px solid #e5332a',
              borderRadius: 999,
              padding: '8px 12px',
              minHeight: 40,
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function YearSelect({
  year,
  onYear,
}: {
  year: number;
  onYear: (year: number) => void;
}) {
  const years = [year - 2, year - 1, year, year + 1];
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#f0b4ae' }}>
      Year
      <select
        value={year}
        onChange={(event) => onYear(Number(event.target.value))}
        style={{ background: '#241014', color: '#fff', border: '1px solid #e5332a', borderRadius: 8, padding: '8px 10px', minHeight: 40 }}
      >
        {years.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p style={{ color: '#e7c4bf', margin: '8px 0' }}>{children}</p>;
}

export function shortMonth(label: string): string {
  return label.slice(0, 3);
}
