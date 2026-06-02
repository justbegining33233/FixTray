'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCheckCircle, FaLock, FaUnlock } from 'react-icons/fa';

type Step = 'idle' | 'setup' | 'verify' | 'disable';

export default function ManagerTwoFactorPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/2fa/status', { headers: authHeaders })
      .then(r => r.json())
      .then(d => setEnabled(d.enabled ?? false))
      .catch(() => {});
  }, [user]);

  const startSetup = async () => {
    setFetching(true); setErrorMsg(null);
    const r = await fetch('/api/auth/2fa/setup', { method: 'POST', headers: authHeaders });
    if (r.ok) { const d = await r.json(); setQrCode(d.qrCode); setSecret(d.secret); setStep('setup'); }
    else setErrorMsg('Failed to start 2FA setup');
    setFetching(false);
  };

  const verify = async () => {
    setFetching(true); setErrorMsg(null);
    const r = await fetch('/api/auth/2fa/verify', { method: 'POST', headers: authHeaders, body: JSON.stringify({ token: tokenInput }) });
    if (r.ok) { setEnabled(true); setStep('idle'); setStatusMsg('Two-factor authentication enabled!'); }
    else setErrorMsg('Invalid code. Please try again.');
    setFetching(false);
  };

  const disable = async () => {
    setFetching(true); setErrorMsg(null);
    const r = await fetch('/api/auth/2fa/disable', { method: 'POST', headers: authHeaders, body: JSON.stringify({ token: tokenInput }) });
    if (r.ok) { setEnabled(false); setStep('idle'); setTokenInput(''); setStatusMsg('Two-factor authentication disabled.'); }
    else setErrorMsg('Invalid code. Cannot disable 2FA.');
    setFetching(false);
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}><FaLock style={{ marginRight: 8 }} />Two-Factor Authentication</h1>

          {statusMsg && <div style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}><FaCheckCircle style={{ marginRight: 6 }} />{statusMsg}</div>}
          {errorMsg && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{errorMsg}</div>}

          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {enabled ? <FaCheckCircle style={{ color: '#22c55e', fontSize: 24 }} /> : <FaUnlock style={{ color: '#f59e0b', fontSize: 24 }} />}
              <span style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600 }}>{enabled ? 'Enabled' : 'Not Enabled'}</span>
            </div>

            {step === 'idle' && (
              <button onClick={enabled ? () => setStep('disable') : startSetup} disabled={fetching} style={{ background: enabled ? 'rgba(239,68,68,0.2)' : 'rgba(229,51,42,0.2)', color: enabled ? '#ef4444' : '#e5332a', border: `1px solid ${enabled ? 'rgba(239,68,68,0.3)' : 'rgba(229,51,42,0.3)'}`, borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {enabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            )}

            {step === 'setup' && qrCode && (
              <div>
                <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 12 }}>Scan this QR code with your authenticator app:</p>
                <img src={qrCode} alt="QR Code" style={{ width: 200, height: 200, marginBottom: 12 }} />
                {secret && <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Manual code: <code style={{ color: '#e5e7eb' }}>{secret}</code></p>}
                <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 16, width: 180, marginRight: 8 }} />
                <button onClick={verify} disabled={fetching || tokenInput.length < 6} style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>Verify</button>
              </div>
            )}

            {step === 'disable' && (
              <div>
                <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 12 }}>Enter a code from your authenticator app to disable 2FA:</p>
                <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 16, width: 180, marginRight: 8 }} />
                <button onClick={disable} disabled={fetching || tokenInput.length < 6} style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}>Disable</button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}


