'use client';
import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';
import { FaPalette, FaWrench, FaMapMarkerAlt, FaPhone, FaEnvelope, FaCheckCircle } from 'react-icons/fa';
import useRequireAuth from '@/lib/useRequireAuth';

interface Branding {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  tagline?: string;
  footerText?: string;
  customDomain?: string;
  businessName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export default function BrandingPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop']);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Branding>({
    logoUrl: '', primaryColor: '#e5332a', accentColor: '#f59e0b',
    tagline: '', footerText: '', customDomain: '',
    businessName: '', address: '', phone: '', email: '', website: '',
  });

  const load = async () => {
    const token = localStorage.getItem('token');
    const r = await fetch('/api/branding', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { const d = await r.json(); if (d) setForm(p => ({ ...p, ...d })); }
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setSaveError(d.error || 'Failed to save branding.'); }
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (err: any) { setSaveError(err?.message || 'Network error.'); }
    setSaving(false);
  };

  const update = (k: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  const previewBg = form.primaryColor || '#e5332a';

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><FaPalette style={{fontSize:26}} /> {say("Shop Branding")}</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>{say("Customize your customer-facing pages, invoices, and communications")}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={save} disabled={saving} style={{ background: saved ? '#22c55e' : '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {saved ? <><FaCheckCircle style={{marginRight:6}} />{say("Saved!")}</> : saving ? say("Saving...") : say("Save Branding")}
          </button>
          {saveError && <div style={{ color: '#ef4444', fontSize: 13 }}>{say(saveError)}</div>}
        </div>
      </div>

      {loading ? <div style={{ padding: 48, color: '#6b7280' }}>{say("Loading...")}</div> : (
        <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28 }}>
          {/* Form */}
          <div>
            <section style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{say("Business Info")}</h3>
              {[["businessName", say("Business Name"), say("FixTray Auto Repair")], ['tagline', say("Tagline"), say("Your trusted local auto shop")], ['address', say("Address"), say("123 Main St, Anytown, NY 10001")], ['phone', say("Phone"), '(555) 123-4567'], ['email', say("Email"), say("service@yourshop.com")], ['website', say("Website"), 'https://yourshop.com']].map(([k, label, ph]) => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say(label)}</label>
                  <input value={(form as any)[k] || ''} onChange={update(k as keyof Branding)} placeholder={say(ph)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              ))}
            </section>

            <section style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{say("Colors & Visual Identity")}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {[["primaryColor", say("Primary Color")], ["accentColor", say("Accent Color")]].map(([k, label]) => (
                  <div key={k}>
                    <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say(label)}</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={(form as any)[k] || '#e5332a'} onChange={update(k as keyof Branding)}
                        style={{ width: 52, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent', padding: 0 }} />
                      <input value={(form as any)[k] || ''} onChange={update(k as keyof Branding)} placeholder="#e5332a"
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say("Logo URL")}</label>
                <input value={form.logoUrl || ''} onChange={update('logoUrl')} placeholder="https://yourshop.com/logo.png"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{say("Invoice & Email Footer")}</h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say("Footer Text")}</label>
                <textarea value={form.footerText || ''} onChange={update('footerText')} rows={3}
                  placeholder={say("Thank you for your business! All repairs come with a 12-month / 12,000-mile warranty.")}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 5 }}>{say("Custom Domain (for payment links)")}</label>
                <input value={form.customDomain || ''} onChange={update('customDomain')} placeholder="pay.yourshop.com"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </section>
          </div>

          {/* Live Preview */}
          <div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 24 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', fontSize: 12, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{say("Live Preview")}</div>
              {/* Preview: branded header */}
              <div style={{ background: '#1a1a2e', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                {form.logoUrl ? <img src={form.logoUrl} alt={say("Logo")} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ height: 36, borderRadius: 6 }} /> :
                  <div style={{ width: 40, height: 40, background: previewBg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><FaWrench /></div>}
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{form.businessName || say("Your Shop Name")}</div>
                  {form.tagline && <div style={{ color: '#9ca3af', fontSize: 11 }}>{say(form.tagline)}</div>}
                </div>
              </div>
              {/* Preview: invoice section */}
              <div style={{ padding: 16, background: '#fff' }}>
                <div style={{ background: previewBg, color: '#fff', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{say("INVOICE #WO-001")}</span>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>$450.00</span>
                </div>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                  {form.address && <div><FaMapMarkerAlt style={{marginRight:4}} />{say(form.address)}</div>}
                  {form.phone && <div><FaPhone style={{marginRight:4}} />{say(form.phone)}</div>}
                  {form.email && <div><FaEnvelope style={{marginRight:4}} />{say(form.email)}</div>}
                </div>
                {form.footerText && (
                  <div style={{ fontSize: 11, color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: 8, fontStyle: 'italic' }}>{say(form.footerText)}</div>
                )}
              </div>
              {/* Preview: pay button */}
              <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button style={{ width: '100%', background: form.accentColor || '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 700 }}>{say("Pay Now")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
