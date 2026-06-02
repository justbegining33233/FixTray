'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaGlobe, FaArrowLeft, FaCog,
  FaBell, FaSave, FaCheck,
} from 'react-icons/fa';

export default function SuperAdminSettings() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading || !user) return;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/admin/settings', { headers, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setSettings(data || {
        platformName: 'FixTray',
        maintenanceMode: false,
        allowSignups: true,
        defaultLanguage: 'en',
        emailNotifications: true,
        maxFileSize: 10,
      }))
      .catch(() => setSettings({
        platformName: 'FixTray',
        maintenanceMode: false,
        allowSignups: true,
        defaultLanguage: 'en',
        emailNotifications: true,
        maxFileSize: 10,
      }))
      .finally(() => setLoading(false));
  }, [user, isLoading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently handle
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user || !settings) return null;

  return (
    <div className="min-h-screen p-4 md:p-8 pt-20 md:pt-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={"/admin/home" as Route} className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-lg">
              <FaArrowLeft className="w-4 h-4 text-[#94a3b8]" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Global Settings</h1>
              <p className="text-[#94a3b8] mt-1">Platform-wide configuration</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-colors font-medium" style={{background:"#e5332a"}}
          >
            {saved ? <FaCheck className="w-4 h-4" /> : <FaSave className="w-4 h-4" />}
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* General */}
        <div className="rounded-2xl p-6 mb-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
          <div className="flex items-center gap-2 mb-4">
            <FaCog className="w-5 h-5 text-[#ff6b64]" />
            <h2 className="text-lg font-semibold text-white">General</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1">Platform Name</label>
              <input
                type="text"
                value={settings.platformName || ''}
                onChange={e => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#e5332a] focus:border-transparent text-[#f1f5f9]" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.14)"}}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1">Default Language</label>
              <select
                value={settings.defaultLanguage || 'en'}
                onChange={e => setSettings({ ...settings, defaultLanguage: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[#e5332a] text-[#f1f5f9]" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.14)"}}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>
        </div>

        {/* Access */}
        <div className="rounded-2xl p-6 mb-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
          <div className="flex items-center gap-2 mb-4">
            <FaGlobe className="w-5 h-5 text-[#ff6b64]" />
            <h2 className="text-lg font-semibold text-white">Access Controls</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div>
                <p className="font-medium text-[#f1f5f9]">Allow New Signups</p>
                <p className="text-sm text-[#94a3b8]">Let new users register on the platform</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowSignups}
                onChange={e => setSettings({ ...settings, allowSignups: e.target.checked })}
                className="w-5 h-5 rounded text-[#ff6b64] focus:ring-[#e5332a]"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div>
                <p className="font-medium text-[#f1f5f9]">Maintenance Mode</p>
                <p className="text-sm text-[#94a3b8]">Show maintenance page to all non-admin users</p>
              </div>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="w-5 h-5 rounded text-[#ff6b64] focus:ring-[#e5332a]"
              />
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl p-6 mb-6" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
          <div className="flex items-center gap-2 mb-4">
            <FaBell className="w-5 h-5 text-[#ff6b64]" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div>
              <p className="font-medium text-[#f1f5f9]">Email Notifications</p>
              <p className="text-sm text-[#94a3b8]">Send system alerts and reports via email</p>
            </div>
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={e => setSettings({ ...settings, emailNotifications: e.target.checked })}
              className="w-5 h-5 rounded text-[#ff6b64] focus:ring-[#e5332a]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

