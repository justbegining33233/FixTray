"use client";
import { FaTimes } from 'react-icons/fa';
import { useState } from 'react';

type Props = { onClose?: () => void };

export default function PasswordResetForm({ onClose }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [via, setVia] = useState<'email'|'sms'>('email');
  const [step, setStep] = useState<'request'|'confirm'>('request');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestToken = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setStatus(null);
    if (!identifier) { setStatus('Enter your username/email/phone'); return; }
    setLoading(true);
    try {
      await fetch('/api/auth/reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, via, type: 'password_reset' }),
      });
      setStep('confirm');
      setStatus('If an account exists, a verification code was sent.');
    } catch (_err:any) {
      setStatus('Failed to send verification code');
    } finally { setLoading(false); }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!token || !password) { setStatus('Code and new password required'); return; }
    if (password !== confirm) { setStatus('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, token, password, type: 'password_reset' }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Password updated. You may now log in.');
        setStep('request'); setIdentifier(''); setToken(''); setPassword(''); setConfirm('');
      } else {
        setStatus(data?.error || 'Failed to reset password');
      }
    } catch (_err:any) {
      setStatus('Network error');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-20"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => onClose && onClose()}
      />
      <div
        className="password-reset-modal relative p-0 rounded shadow-lg"
        style={{position:'absolute', left:'35%', top:'4.5rem', width:'4in', height:'2.5in', maxWidth:'4in', maxHeight:'2.5in'}}
      >
        <div className="sos-card h-full w-full p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Reset Password</h3>
          <button aria-label="Close" onClick={() => onClose && onClose()} className="text-gray-600 hover:text-gray-900"><FaTimes style={{marginRight:4}} /></button>
        </div>
      {step === 'request' && (
        <form onSubmit={requestToken}>
          <div className="mb-2">
            <label className="block text-sm">Delivery</label>
            <select value={via} onChange={e=>setVia(e.target.value as any)} className="sos-input w-full">
              <option value="email">Email</option>
              <option value="sms">SMS (if phone on file)</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="block text-sm">Username / Email / Phone</label>
            <input value={identifier} onChange={e=>setIdentifier(e.target.value)} className="sos-input w-full" />
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-white rounded" style={{background:'#e5332a'}} disabled={loading}>Send Code</button>
            <span className="text-sm text-gray-700">{status}</span>
          </div>
        </form>
      )}
      {step === 'confirm' && (
        <form onSubmit={confirmReset}>
          <div className="mb-2">
            <label className="block text-sm">Verification Code</label>
            <input value={token} onChange={e=>setToken(e.target.value)} className="sos-input w-full" />
          </div>
          <div className="mb-2">
            <label className="block text-sm">New Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="sos-input w-full" />
          </div>
          <div className="mb-2">
            <label className="block text-sm">Confirm Password</label>
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="sos-input w-full" />
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-white rounded" style={{background:'#e5332a'}} disabled={loading}>{loading ? 'Processing...' : 'Confirm & Set Password'}</button>
            <span className="text-sm text-[#94a3b8]">{status}</span>
          </div>
        </form>
      )}
      </div>
    </div>
  </div>
  );
}
