'use client';
import { useState } from 'react';
import Link from 'next/link';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';

type Step = 'request' | 'confirm' | 'done';

export default function ResetPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const _res = await fetch('/api/auth/reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), via: 'email' }),
      });
      // Always move forward  -  API returns success even for unknown accounts
      setStep('confirm');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), token: token.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid or expired code.'); return; }
      setStep('done');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: 20 }}>
      <div style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 8px 36px rgba(0,0,0,0.55)' }}>
        {step === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}><FaCheckCircle style={{marginRight:4}} /></div>
            <h2 style={{ marginBottom: 8, color: '#f1f5f9' }}>Password Updated</h2>
            <p style={{ color: '#94a3b8', marginBottom: 24 }}>Your password has been reset successfully.</p>
            <Link href="/auth/login" style={{ display: 'inline-block', background: '#e5332a', color: 'white', padding: '12px 32px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
              Back to Login
            </Link>
          </div>
        ) : step === 'confirm' ? (
          <>
            <h2 style={{ marginBottom: 4, color: '#f1f5f9', fontSize: 22 }}>Enter your code</h2>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>
              If <strong>{identifier}</strong> has an account, we emailed a verification code. Check your inbox.
            </p>
            <form onSubmit={handleConfirm}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>Verification Code</label>
                <input
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Enter the code from your email"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9' }}
                />
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '12px', background: loading ? 'rgba(229,51,42,0.5)' : '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Updating...' : 'Reset Password'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('request'); setToken(''); setPassword(''); setConfirm(''); setError(''); }}
                style={{ width: '100%', padding: '10px', background: 'transparent', color: '#94a3b8', border: 'none', fontSize: 14, cursor: 'pointer', marginTop: 8 }}
              >
                <FaArrowLeft style={{marginRight:4}} /> Use a different email
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 4, color: '#f1f5f9', fontSize: 22 }}>Forgot Password</h2>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>Enter your email or username and we'll send you a reset code.</p>
            <form onSubmit={handleRequest}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>Email or Username</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9' }}
                />
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '12px', background: loading ? 'rgba(229,51,42,0.5)' : '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#94a3b8' }}>
              Remember it?{' '}
              <Link href="/auth/login" style={{ color: '#e5332a', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
