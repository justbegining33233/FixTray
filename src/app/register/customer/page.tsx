'use client';
import { useState } from 'react';
import Link from 'next/link';
import { FaSmile } from 'react-icons/fa';

export default function CustomerRegisterPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      // Get CSRF token first
      let csrfToken = '';
      try {
        const csrfRes = await fetch('/api/auth/csrf');
        if (csrfRes.ok) { const d = await csrfRes.json(); csrfToken = d.token || ''; }
      } catch { /* optional */ }

      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify({
          email: form.email.trim(),
          username: form.email.split('@')[0].trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed. Please try again.'); return; }
      setDone(true);
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 8,
    fontSize: 15,
    boxSizing: 'border-box' as const,
    marginTop: 4,
    background: 'rgba(255,255,255,0.04)',
    color: '#f1f5f9',
  };

  const labelStyle = { display: 'block', fontSize: 14, fontWeight: 500 as const, color: '#94a3b8' };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <div style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 8px 36px rgba(0,0,0,0.55)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><FaSmile style={{marginRight:4}} /></div>
          <h2 style={{ marginBottom: 8, color: '#f1f5f9' }}>Account Created!</h2>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>Your account is ready. You can now sign in.</p>
          <Link href="/auth/login" style={{ display: 'inline-block', background: '#e5332a', color: 'white', padding: '12px 32px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: 20 }}>
      <div style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 40, width: '100%', maxWidth: 480, boxShadow: '0 8px 36px rgba(0,0,0,0.55)' }}>
        <h2 style={{ marginBottom: 4, color: '#f1f5f9', fontSize: 22 }}>Create Customer Account</h2>
        <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: 14 }}>Track your work orders and communicate with your shop.</p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} required style={inputStyle} placeholder="John" />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)} required style={inputStyle} placeholder="Doe" />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email Address</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required style={inputStyle} placeholder="john@example.com" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input type="password" value={form.password} onChange={e => update('password', e.target.value)} required style={inputStyle} placeholder="At least 8 characters" />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Confirm Password</label>
            <input type="password" value={form.confirm} onChange={e => update('confirm', e.target.value)} required style={inputStyle} placeholder="Repeat password" />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: loading ? 'rgba(229,51,42,0.5)' : '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#94a3b8' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#e5332a', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#475569' }}>
          Are you a shop?{' '}
          <Link href="/auth/register/shop" style={{ color: '#64748b', textDecoration: 'none' }}>Register your shop</Link>
        </p>
      </div>
    </div>
  );
}
