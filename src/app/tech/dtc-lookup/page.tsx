'use client';
import { useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaExclamationTriangle, FaSearch } from 'react-icons/fa';

interface DTCResult {
  code: string;
  description: string;
  severity: string;
  systems: string[];
  possibleCauses: string[];
  commonFixes: string[];
}

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: 'rgba(229,51,42,0.15)', color: '#e5332a' },
  moderate: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  minor:    { bg: 'rgba(96,165,250,0.15)', color: '#ff6b64' },
};

export default function DTCLookupPage() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<DTCResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<DTCResult[]>([]);

  const lookup = async () => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    setLoading(true);
    setError('');
    setResult(null);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/dtc-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: cleaned }),
    });
    if (r.ok) {
      const data = await r.json();
      setResult(data);
      setHistory(prev => [data, ...prev.filter(h => h.code !== data.code)].slice(0, 10));
    } else {
      const e = await r.json();
      setError(e.error || 'Code not found');
    }
    setLoading(false);
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaSearch style={{marginRight:4}} /> DTC Code Lookup</h1>
        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Diagnose OBD-II fault codes with detailed repair information</p>
      </div>

      <div style={{ padding: 32, maxWidth: 720 }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="Enter DTC code (e.g. P0300, P0420, C1234...)"
            style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '14px 18px', color: '#e5e7eb', fontSize: 18, letterSpacing: '0.1em', fontFamily: 'monospace' }} />
          <button onClick={lookup} disabled={loading}
            style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer', minWidth: 100 }}>
            {loading ? '...' : 'Lookup'}
          </button>
        </div>

        {/* Quick Codes */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Common codes:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['P0300', 'P0420', 'P0101', 'P0171', 'P0440', 'P0128', 'B0100', 'C1234', 'U0100', 'P0562'].map(c => (
              <button key={c} onClick={() => { setCode(c); }} style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 12px', fontSize: 13, fontFamily: 'monospace', cursor: 'pointer' }}>{c}</button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 10, padding: 16, color: '#fca5a5', marginBottom: 20 }}>
            <FaExclamationTriangle style={{marginRight:4}} /> {error}  -  This code may be vehicle-specific or not in our database. Try Googling it or consult the vehicle service manual.
          </div>
        )}

        {result && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{result.code}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{result.description}</div>
              </div>
              <span style={{ background: SEVERITY_STYLE[result.severity]?.bg || 'rgba(255,255,255,0.1)', color: SEVERITY_STYLE[result.severity]?.color || '#9ca3af', border: `1px solid ${SEVERITY_STYLE[result.severity]?.color || '#9ca3af'}`, borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                {result.severity}
              </span>
            </div>

            {result.systems?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Affected Systems</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {result.systems.map(s => <span key={s} style={{ background: 'rgba(96,165,250,0.15)', color: '#ff6b64', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 6, padding: '3px 10px', fontSize: 13 }}>{s}</span>)}
                </div>
              </div>
            )}

            {result.possibleCauses?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Possible Causes</div>
                <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#d1d5db', fontSize: 14, lineHeight: 1.8 }}>
                  {result.possibleCauses.map(c => <li key={c}>{c}</li>)}
                </ul>
              </div>
            )}

            {result.commonFixes?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Common Fixes</div>
                <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#d1d5db', fontSize: 14, lineHeight: 1.8 }}>
                  {result.commonFixes.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recent Lookups */}
        {history.length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>Recent lookups this session:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {history.map(h => (
                <button key={h.code} onClick={() => { setCode(h.code); setResult(h); }}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e5e7eb' }}>{h.code}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#6b7280', marginTop: 2 }}>{h.description.slice(0, 30)}...</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

