'use client';

import { useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePhrase } from '@/lib/usePhrase';
import { FaArrowLeft } from 'react-icons/fa';

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 8,
  color: '#e5e7eb',
  fontSize: 14,
};

const USER_LIST = '/admin/user-management' as Route;

export default function AddUserPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const setField = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.isOwner) {
      setError('Only FixTray Owner can create FixTray Admin employees.');
      return;
    }
    const username = form.username.trim();
    const email = form.email.trim();
    if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || form.password.length < 8) {
      setError('Username, a valid email, and a password of at least 8 characters are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ username, email, password: form.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to create employee account.');
        return;
      }
      setCreated(true);
    } catch {
      setError('Failed to create employee account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        {say("Loading...")}
      </div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
        <Link href={USER_LIST} style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, display: 'inline-block', marginBottom: 16 }}>
          <FaArrowLeft style={{ marginRight: 4 }} /> {say("Back to User Management")}
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>{say("Add User")}</h1>
        <p style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 24 }}>{say("Create new admin or user")}</p>

        {created ? (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: '#22c55e', fontWeight: 700, marginBottom: 8 }}>{say("Create FixTray Employee")}</p>
            <p style={{ color: '#e5e7eb', marginBottom: 16 }}>{form.username}</p>
            <Link href={USER_LIST} style={{ color: '#e5332a', fontWeight: 700, textDecoration: 'none' }}>
              {say("User Management")}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, display: 'grid', gap: 14 }}>
            <p style={{ fontSize: 13, color: '#9aa3b2', margin: 0 }}>
              {say("This form creates a FixTray Admin employee. New employees use the FixTray dashboard.")}
            </p>
            {!user.isOwner && (
              <p style={{ fontSize: 13, color: '#fbbf24', margin: 0 }}>
                {say("Only the FixTray Owner (supadm) can create FixTray Admin employees.")}
              </p>
            )}
            <label style={{ display: 'grid', gap: 6, color: '#9aa3b2', fontSize: 13, fontWeight: 600 }}>
              {say("Username")}
              <input name="username" required value={form.username} onChange={setField('username')} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#9aa3b2', fontSize: 13, fontWeight: 600 }}>
              {say("Email")}
              <input name="email" type="email" required value={form.email} onChange={setField('email')} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#9aa3b2', fontSize: 13, fontWeight: 600 }}>
              {say("Temporary Password")}
              <input
                name="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={setField('password')}
                placeholder={say("Minimum 8 characters")}
                style={fieldStyle}
              />
            </label>
            {error && <p style={{ color: '#f87171', margin: 0 }}>{say(error)}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="submit"
                disabled={submitting || !user.isOwner}
                style={{ padding: '10px 18px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: submitting || !user.isOwner ? 'not-allowed' : 'pointer', opacity: submitting || !user.isOwner ? 0.6 : 1 }}
              >
                {submitting ? say("Creating...") : say("Add User")}
              </button>
              <Link href={USER_LIST} style={{ padding: '10px 18px', color: '#e5e7eb', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8 }}>
                {say("Cancel")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
