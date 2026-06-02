'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCheckCircle, FaLock, FaUnlock } from 'react-icons/fa';

type Step = 'idle' | 'setup' | 'verify' | 'disable';

export default function TwoFactorSettingsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [statusMsg, setStatusMsg] = useState<import('react').ReactNode>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/2fa/status', { headers: authHeaders })
      .then(r => r.json())
      .then(d => setEnabled(d.enabled ?? false))
      .catch(() => {});
  }, [user]);

  async function handleSetup() {
    setFetching(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('verify');
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setFetching(false);
    }
  }

  async function handleVerify() {
    if (tokenInput.length !== 6) return;
    setFetching(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setEnabled(true);
      setStep('idle');
      setQrCode(null);
      setSecret(null);
      setTokenInput('');
      setStatusMsg(<><FaCheckCircle style={{marginRight:4}} /> Two-Factor Authentication is now enabled on your account.</>);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setFetching(false);
    }
  }

  async function handleDisable() {
    if (tokenInput.length !== 6) return;
    setFetching(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable');
      setEnabled(false);
      setStep('idle');
      setTokenInput('');
      setStatusMsg('2FA has been disabled.');
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setFetching(false);
    }
  }

  const bg = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        Loading...
      </div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/shop/settings" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Settings
          </Link>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 32, border: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, marginBottom: 8 }}><FaLock style={{marginRight:4}} /> Two-Factor Authentication</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Use an authenticator app (Google Authenticator, Authy, 1Password) to generate time-based one-time codes.
          </p>

          {/* Status badge */}
          <div style={{
            background: enabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${enabled ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 8, padding: '10px 16px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>{enabled ? '' : ''}</span>
            <span style={{ color: enabled ? '#86efac' : '#fca5a5', fontWeight: 600 }}>
              2FA is currently {enabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          {/* Feedback */}
          {statusMsg && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#86efac', fontSize: 14 }}>
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>
              {errorMsg}
            </div>
          )}

          {/* "EUR"EUR"EUR SETUP STEP: show QR code "EUR"EUR"EUR */}
          {step === 'verify' && qrCode && (
            <div style={{ background: 'rgba(229,51,42,0.08)', border: '1px solid rgba(229,51,42,0.25)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ color: '#ffb4ad', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                1. Scan this QR code with your authenticator app
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <img src={qrCode} alt="2FA QR Code" style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <details style={{ marginBottom: 16 }}>
                <summary style={{ color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Can&apos;t scan? Enter the key manually</summary>
                <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 6 }}>
                  {secret}
                </div>
              </details>
              <p style={{ color: '#ffb4ad', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                2. Enter the 6-digit code your app shows
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)', color: '#f1f5f9',
                  fontSize: 22, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center',
                  boxSizing: 'border-box', marginBottom: 12,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleVerify} disabled={tokenInput.length !== 6 || fetching} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: tokenInput.length !== 6 ? 0.5 : 1 }}>
                  {fetching ? 'Activating...' : 'Activate 2FA'}
                </button>
                <button onClick={() => { setStep('idle'); setQrCode(null); setSecret(null); setTokenInput(''); }} style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* "EUR"EUR"EUR DISABLE STEP: confirm with TOTP "EUR"EUR"EUR */}
          {step === 'disable' && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ color: '#fca5a5', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Enter your current authenticator code to confirm
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(255,255,255,0.1)', color: '#f1f5f9',
                  fontSize: 22, fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center',
                  boxSizing: 'border-box', marginBottom: 12,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDisable} disabled={tokenInput.length !== 6 || fetching} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: tokenInput.length !== 6 ? 0.5 : 1 }}>
                  {fetching ? 'Disabling...' : 'Confirm Disable'}
                </button>
                <button onClick={() => { setStep('idle'); setTokenInput(''); }} style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* "EUR"EUR"EUR IDLE STATE: action buttons "EUR"EUR"EUR */}
          {step === 'idle' && (
            <div>
              {!enabled ? (
                <button onClick={handleSetup} disabled={fetching} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: '#e5332a', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  {fetching ? 'Generating...' : <><FaLock style={{marginRight:4}} /> Enable Two-Factor Authentication</>}
                </button>
              ) : (
                <button onClick={() => { setStep('disable'); setTokenInput(''); setErrorMsg(null); }} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  <FaUnlock style={{marginRight:4}} /> Disable Two-Factor Authentication
                </button>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: '#94a3b8' }}>Compatible apps:</strong> Google Authenticator, Authy, Microsoft Authenticator, 1Password, Bitwarden.
              Each code is valid for 30 seconds and can only be used once.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

