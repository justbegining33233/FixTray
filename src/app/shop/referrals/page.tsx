'use client';
import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaCheckCircle, FaGift, FaHourglassHalf } from 'react-icons/fa';

interface Referral {
  id: string;
  referralCode: string;
  referredName?: string;
  referredEmail?: string;
  referredPhone?: string;
  status: string;
  rewardType?: string;
  rewardValue?: number;
  rewardClaimed: boolean;
  notes?: string;
  createdAt: string;
  referrer?: { name?: string; email?: string };
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  converted: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
  rewarded:  { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  expired:   { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
};

export default function ReferralsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ referredName: '', referredEmail: '', referredPhone: '', rewardType: 'discount', rewardValue: '25', referrerId: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/referrals', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setReferrals(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const create = async () => {
    if (!form.referredName.trim()) { setFormError('Referred customer name is required.'); return; }
    const rv = form.rewardValue ? parseFloat(form.rewardValue) : 0;
    if (form.rewardValue && isNaN(rv)) { setFormError('Reward value must be a valid number.'); return; }
    setFormError('');
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, rewardValue: rv }),
    });
    if (r.ok) { setShowNew(false); load(); }
    else { const d = await r.json(); setFormError(d.error || 'Failed to create referral'); }
    setSaving(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  const stats = {
    total: referrals.length,
    converted: referrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length,
    pending: referrals.filter(r => r.status === 'pending').length,
    value: referrals.filter(r => r.rewardValue).reduce((s, r) => s + (r.rewardValue || 0), 0),
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaGift style={{marginRight:4}} /> Referral Program</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Track customer referrals and reward them for bringing in new business</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ New Referral</button>
      </div>

      <div style={{ padding: '24px 32px 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total Referrals', value: stats.total, icon: '' }, { label: 'Converted', value: stats.converted, icon: '' }, { label: 'Pending', value: stats.pending, icon: <FaHourglassHalf style={{marginRight:4}} /> }, { label: 'Rewards Issued', value: `$${stats.value}`, icon: '' }].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 20px', minWidth: 130 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 2px' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          referrals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaGift style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No referrals yet</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Start tracking customer referrals and rewarding loyal customers who bring in new business</div>
              <button onClick={() => setShowNew(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Create First Referral</button>
            </div>
          ) : (
            referrals.map(ref => {
              const st = STATUS_STYLE[ref.status] || STATUS_STYLE.pending;
              return (
                <div key={ref.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{ref.referredName || 'Unknown Referral'}</div>
                      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                        {ref.referredEmail || ref.referredPhone || ''}  {new Date(ref.createdAt).toLocaleDateString()}
                      </div>
                      {ref.referrer?.name && <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 4 }}>Referred by: {ref.referrer.name}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {ref.rewardValue && <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 15 }}>${ref.rewardValue} reward</span>}
                      <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{ref.status}</span>
                      <button onClick={() => copyCode(ref.referralCode)}
                        style={{ background: 'rgba(96,165,250,0.15)', color: '#ff6b64', border: '1px solid #e5332a', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' }}>
                        {copied === ref.referralCode ? <FaCheckCircle style={{marginRight:4}} /> : ref.referralCode}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
      </div>

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 440, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>New Referral</h3>
            {[['referredName', 'Referred Customer Name', 'Jane Smith'], ['referredEmail', 'Email', 'jane@email.com'], ['referredPhone', 'Phone', '(555) 123-4567']].map(([k, label, ph]) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{label}</label>
                <input value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Reward Type</label>
                <select value={form.rewardType} onChange={e => setForm(p => ({ ...p, rewardType: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }}>
                  <option value="discount">$ Discount</option>
                  <option value="credit">Account Credit</option>
                  <option value="gift_card">Gift Card</option>
                  <option value="free_service">Free Service</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Reward Value ($)</label>
                <input value={form.rewardValue} onChange={e => setForm(p => ({ ...p, rewardValue: e.target.value }))} type="number" placeholder="25"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            {formError && (
              <div style={{ marginBottom: 14, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 14px', color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>{formError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={create} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Create Referral'}</button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

