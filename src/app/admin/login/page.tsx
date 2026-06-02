'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { FaLock } from 'react-icons/fa';

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Store admin credentials
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', 'admin');
        // Keep legacy admin keys and populate shared user keys for AuthContext
        localStorage.setItem('adminId', data.admin.id);
        localStorage.setItem('adminUsername', data.admin.username);
        localStorage.setItem('isSuperAdmin', data.admin.isSuperAdmin.toString());
        if (data.admin?.isOwner) localStorage.setItem('isOwner', 'true');
        else localStorage.removeItem('isOwner');

        // Also set shared user keys so the AuthContext picks up the admin as an authenticated user
        localStorage.setItem('userId', data.admin.id);
        localStorage.setItem('userName', data.admin.username);

        // Redirect to super-admin portal if flagged, otherwise admin dashboard
        if (data.admin?.isSuperAdmin) {
          router.push('/admin/home' as Route);
        } else {
          router.push('/admin/dashboard' as Route);
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 48,
          maxWidth: 450,
          width: '100%',
        }}
      >
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><FaLock style={{marginRight:4}} /></div>
          <h1 style={{ color: '#fff', fontSize: 28, margin: 0, marginBottom: 8 }}>Admin Access</h1>
          <p style={{ color: '#9aa3b2', margin: 0, fontSize: 14 }}>FixTray Management Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 24,
                color: '#ef4444',
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                color: '#9aa3b2',
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '14px 16px',
                color: '#fff',
                fontSize: 15,
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#e5332a';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label
              style={{
                display: 'block',
                color: '#9aa3b2',
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '14px 16px',
                color: '#fff',
                fontSize: 15,
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#e5332a';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#6b7280' : '#e5332a',
              color: '#fff',
              border: 'none',
              padding: '16px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 12 }}>
            Authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
}
