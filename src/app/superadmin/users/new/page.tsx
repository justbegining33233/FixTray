'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { usePhrase } from '@/lib/usePhrase';
import { FaArrowLeft } from 'react-icons/fa';

export default function AddUserPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.isOwner) {
      setError('Only FixTray Owner can create FixTray Admin employees.');
      return;
    }
    const username = form.username.trim();
    const email = form.email.trim();
    if (!username || !email || form.password.length < 8) {
      setError('Username, email, and password are required.');
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
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        {say("Loading...")}
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-xl mx-auto">
        <Link href={"/superadmin/users" as Route} className="inline-flex items-center gap-2 text-sm text-[#ff6b64] mb-4">
          <FaArrowLeft /> {say("User Management")}
        </Link>
        <h1 className="text-3xl font-bold mb-2">{say("Add User")}</h1>
        <p className="text-zinc-400 mb-6">{say("Create new admin or user")}</p>

        {created ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <p className="font-semibold text-emerald-300 mb-2">{say("Create FixTray Employee")}</p>
            <p className="text-white mb-4">{form.username}</p>
            <Link href={"/superadmin/users" as Route} className="text-[#ff6b64] font-semibold">
              {say("User Management")}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/5 p-6 grid gap-4">
            <p className="text-xs text-zinc-400">
              {say("This Team tab is for FixTray internal staff accounts only. New employees are created as FixTray Admin and use the FixTray dashboard.")}
            </p>
            {!user.isOwner && (
              <p className="text-sm text-amber-300">
                {say("Only the FixTray Owner (supadm) can create FixTray Admin employees.")}
              </p>
            )}
            <label className="grid gap-1 text-sm text-zinc-300">
              {say("Username")}
              <input
                name="username"
                required
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                className="rounded-xl bg-black border border-white/10 px-3 py-2 text-white"
              />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              {say("Email")}
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="rounded-xl bg-black border border-white/10 px-3 py-2 text-white"
              />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              {say("Temporary Password")}
              <input
                name="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder={say("Minimum 8 characters")}
                className="rounded-xl bg-black border border-white/10 px-3 py-2 text-white"
              />
            </label>
            {error && <p className="text-sm text-red-400">{say(error)}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !user.isOwner}
                className="px-4 py-2 rounded-xl bg-[#e5332a] text-white font-semibold disabled:opacity-50"
              >
                {submitting ? say("Creating...") : say("Create Employee")}
              </button>
              <Link href={"/superadmin/users" as Route} className="px-4 py-2 rounded-xl border border-white/15 text-zinc-200">
                {say("Cancel")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
