'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { useAuth } from '@/contexts/AuthContext';

export default function TechTwoFactorAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const mode = useMemo(() => (searchParams?.get('mode') === 'setup' ? 'setup' : 'challenge'), [searchParams]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'init' | 'verify'>('init');

  const getTempToken = () => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('tech2fa_temp_token');
  };

  const beginSetup = async () => {
    const tempToken = getTempToken();
    if (!tempToken) {
      setError('Session expired. Please log in again.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/tech-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, action: 'setup' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start 2FA setup');

      setSecret(data.base32 || '');
      setStep('verify');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const tempToken = getTempToken();
    if (!tempToken) {
      setError('Session expired. Please log in again.');
      return;
    }
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/tech-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, action: 'verify', token: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid verification code');
      if (!data.accessToken) throw new Error('Verification completed but no access token was returned.');

      login({
        token: data.accessToken,
        role: data.role,
        name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Employee',
        id: data.id,
        shopId: data.shopId,
      });

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tech2fa_temp_token');
      }

      const nextPath = data.role === 'manager' ? '/manager/home' : '/tech/home';
      router.push(nextPath as Route);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#07090d', color: '#e5e7eb', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Employee Verification</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 18 }}>
          {mode === 'setup'
            ? 'Your shop requires two-factor authentication. Set it up once, then verify to finish login.'
            : 'Enter the 6-digit code from your authenticator app to complete sign in.'}
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#fecaca', borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 13 }}>
            {error}
          </div>
        )}

        {mode === 'setup' && step === 'init' && (
          <button
            onClick={beginSetup}
            disabled={loading}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: 'none', background: '#e5332a', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Preparing setup...' : 'Start 2FA Setup'}
          </button>
        )}

        {(mode === 'challenge' || step === 'verify') && (
          <>
            {secret && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Authenticator key:</div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                  {secret}
                </div>
              </div>
            )}

            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>6-digit code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              style={{ width: '100%', marginBottom: 14, padding: '12px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(0,0,0,0.35)', color: '#fff', letterSpacing: 4, textAlign: 'center', fontSize: 20, fontFamily: 'monospace' }}
            />

            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: 'none', background: '#e5332a', color: '#fff', fontWeight: 700, cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer', opacity: loading || code.length !== 6 ? 0.6 : 1 }}
            >
              {loading ? 'Verifying...' : 'Complete Login'}
            </button>
          </>
        )}

        <button
          onClick={() => router.push('/auth/login' as Route)}
          style={{ marginTop: 12, width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer' }}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
