'use client';

const ACCENT = '#e5332a';

function points(vals: number[], w: number, h: number) {
  const max = Math.max(...vals, 1) * 1.1;
  const pad = 8;
  const innerH = h - 22;
  return vals.map((v, i) => {
    const x = vals.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (vals.length - 1);
    const y = 4 + innerH * (1 - v / max);
    return [x, y] as const;
  });
}

export function LineChart({
  values,
  labels,
  color = ACCENT,
  height = 96,
  values2,
  color2 = '#22c55e',
}: {
  values: number[];
  labels?: string[];
  color?: string;
  height?: number;
  values2?: number[];
  color2?: string;
}) {
  const w = 320;
  const series = values.length ? values : [0];
  const pts = points(series, w, height);
  const poly = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const base = height - 18;
  const id = `pm${color.replace('#', '')}${series.length}`;
  const second = values2 && values2.length
    ? points(values2, w, height).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    : '';
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="8" x2={w - 8} y1={4 + (i * (height - 22)) / 3} y2={4 + (i * (height - 22)) / 3} stroke="rgba(255,255,255,0.06)" />
      ))}
      <polygon points={`8,${base} ${poly} ${w - 8},${base}`} fill={`url(#${id})`} />
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      {second ? <polyline points={second} fill="none" stroke={color2} strokeWidth="2.2" /> : null}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#000" stroke={color} strokeWidth="1.6" />
      ))}
      {(labels || []).map((label, i) => {
        const x = labels && labels.length === 1 ? w / 2 : 8 + (i * (w - 16)) / Math.max((labels?.length || 1) - 1, 1);
        return (
          <text key={label + i} x={x} y={height - 4} fill="#475569" fontSize="9" textAnchor="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function BarChart({
  values,
  labels,
  colors,
  height = 84,
}: {
  values: number[];
  labels?: string[];
  colors?: string[];
  height?: number;
}) {
  const w = 320;
  const series = values.length ? values : [0];
  const max = Math.max(...series, 1) * 1.1;
  const bw = (w - 24) / series.length;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} role="img">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="12" x2={w - 6} y1={6 + (i * (height - 24)) / 3} y2={6 + (i * (height - 24)) / 3} stroke="rgba(255,255,255,0.06)" />
      ))}
      {series.map((v, i) => {
        const bh = ((height - 24) * v) / max;
        const fill = colors?.[i] || ACCENT;
        return (
          <g key={i}>
            <rect x={14 + i * bw + bw * 0.2} y={height - 18 - bh} width={bw * 0.6} height={Math.max(bh, 0)} rx="4" fill={fill} />
            {labels?.[i] ? (
              <text x={14 + i * bw + bw / 2} y={height - 4} fill="#475569" fontSize="9" textAnchor="middle">
                {labels[i]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  parts,
  center = '',
  sub = '',
  size = 96,
  thickness = 12,
}: {
  parts: Array<[number, string]>;
  center?: string;
  sub?: string;
  size?: number;
  thickness?: number;
}) {
  const empty: Array<[number, string]> = [[1, 'rgba(255,255,255,0.07)']];
  const safe = parts.some((p) => p[0] > 0) ? parts : empty;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = safe.reduce((sum, part) => sum + part[0], 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={thickness} />
      {safe.map(([value, color], index) => {
        const len = (c * value) / total;
        const node = (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={`${Math.max(len - 2, 0)} ${c}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return node;
      })}
      <text x="50%" y={size / 2 + 2} textAnchor="middle" fill="#f1f5f9" fontSize="18" fontWeight="800">
        {center}
      </text>
      <text x="50%" y={size / 2 + 16} textAnchor="middle" fill="#94a3b8" fontSize="9">
        {sub}
      </text>
    </svg>
  );
}

export function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
      {items.map(([label, color]) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#94a3b8' }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'block' }} />
          {label}
        </span>
      ))}
    </div>
  );
}
