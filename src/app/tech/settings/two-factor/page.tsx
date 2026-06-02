'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCheckCircle, FaLock, FaShieldAlt } from 'react-icons/fa';

export default function TechTwoFactorPage() {
  const { user, isLoading } = useRequireAuth(['tech', 'manager']);
  const router = useRouter();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [enabled, setEnabled] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const startSetup = async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch('/api/auth/tech-2fa', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'setup' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('verify');
    } catch (e: any) {
      setError(e.message);
    } finally { setFetching(false); }
  };

  const verify = async () => {
    if (code.length !== 6) { setError('Enter a 6-digit code'); return; }
    setFetching(true);
    setError('');
    try {
      const res = await fetch('/api/auth/tech-2fa', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'verify', code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      // Store new tokens if returned
      if (data.token) localStorage.setItem('token', data.token);
      setEnabled(true);
      setStep('idle');
      setQrCode(null);
      setSecret(null);
      setCode('');
      setSuccess('Two-factor authentication is now enabled on your account.');
    } catch (e: any) {
      setError(e.message);
    } finally { setFetching(false); }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <button onClick={() => router.back()}
          style={{ color: '#ff6b64', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>
          <FaArrowLeft style={{marginRight:4}} /> Back
        </button>
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, border: '1px solid #334155' }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}><FaLock style={{marginRight:4}} /> Two-Factor Authentication</h1>
          <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24 }}>
            Add an extra layer of security to your account using an authenticator app.
          </p>

          {error && <div style={{ background: '#450a0a', color: '#ef4444', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>{error}</div>}
          {success && <div style={{ background: '#052e16', color: '#22c55e', border: '1px solid #16a34a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}><FaCheckCircle style={{marginRight:4}} /> {success}</div>}

          {enabled || success ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}><FaShieldAlt style={{marginRight:4}} /></div>
              <div style={{ color: '#22c55e', fontWeight: 600, fontSize: 16 }}>2FA is Enabled</div>
              <div style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>Your account is secured with two-factor authentication.</div>
            </div>
          ) : step === 'idle' ? (
            <button onClick={startSetup} disabled={fetching}
              style={{ width: '100%', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', cursor: 'pointer', fontWeight: 600, fontSize: 16, opacity: fetching ? 0.5 : 1 }}>
              {fetching ? 'Setting up...' : 'Enable 2FA'}
            </button>
          ) : (
            <>
              {qrCode && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>Scan this QR code with your authenticator app:</div>
                  <div style={{ background: '#fff', display: 'inline-block', padding: 12, borderRadius: 12 }}>
                    <img src={qrCode} alt="QR Code" style={{ width: 200, height: 200 }} />
                  </div>
                </div>
              )}
              {secret && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>Or enter this key manually:</div>
                  <div style={{ background: '#000000', color: '#e5e7eb', fontFamily: 'monospace', fontSize: 14, padding: '10px 12px', borderRadius: 8, wordBreak: 'break-all' }}>
                    {secret}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>Enter 6-digit code from your app</label>
                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '12px', fontSize: 20, textAlign: 'center', letterSpacing: 8, fontFamily: 'monospace' }} />
              </div>
              <button onClick={verify} disabled={fetching || code.length !== 6}
                style={{ width: '100%', background: '#e5332a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', cursor: 'pointer', fontWeight: 600, fontSize: 16, opacity: fetching || code.length !== 6 ? 0.5 : 1 }}>
                {fetching ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


