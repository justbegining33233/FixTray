'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowDown, FaArrowLeft, FaBox, FaCheck, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, FaInfoCircle, FaSave } from 'react-icons/fa';

export default function BackupRestore() {
  const { user, isLoading } = useRequireAuth(['admin']);
  const [downloading, setDownloading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/backup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fixtray-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastBackup(new Date().toLocaleString());
      showToast('Backup downloaded successfully');
    } catch {
      showToast('Backup failed  -  try again', false);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.ok ? '#22c55e' : '#ef4444', color: '#fff', padding: '12px 20px', borderRadius: 8, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '16px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/admin/home" style={{ color: '#e5332a', fontSize: 22, fontWeight: 900, textDecoration: 'none' }}>FixTray Admin</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}><FaSave style={{marginRight:4}} /> Backup & Restore</h1>
          <Link href="/admin/system-settings" style={{ color: '#9aa3b2', fontSize: 13, textDecoration: 'none' }}><FaArrowLeft style={{marginRight:4}} /> System Settings</Link>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px' }}>
        <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 10, padding: '16px 20px', marginBottom: 28, display: 'flex', gap: 12 }}>
          <div style={{ fontSize: 20 }}><FaInfoCircle style={{marginRight:4}} /></div>
          <div style={{ fontSize: 13, color: '#9aa3b2', lineHeight: 1.6 }}>
            Backups export a JSON snapshot of all platform data. Sensitive fields (passwords, payment tokens) are excluded. Store backups securely.
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#e5e7eb', fontSize: 16 }}>Download Full Backup</div>
              <div style={{ fontSize: 13, color: '#9aa3b2', marginTop: 3 }}>Exports platform data as a JSON file</div>
            </div>
            <div style={{ fontSize: 28 }}><FaBox style={{marginRight:4}} /></div>
          </div>
          <div style={{ padding: '24px' }}>
            {lastBackup && (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#86efac' }}>
                <FaCheckCircle style={{marginRight:4}} /> Last backup: {lastBackup}
              </div>
            )}
            <button onClick={handleDownload} disabled={downloading}
              style={{ background: downloading ? '#444' : '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer' }}>
              {downloading ? <><FaHourglassHalf style={{marginRight:4}} /> Preparing...</> : <><FaArrowDown style={{marginRight:4}} /> Download Backup (JSON)</>}
            </button>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, color: '#e5e7eb', fontSize: 15, marginBottom: 16 }}>What's included</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {['Shops', 'Customers', 'Technicians', 'Work Orders', 'Appointments', 'Reviews', 'Invoices', 'Notifications'].map(item => (
              <div key={item} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e' }}><FaCheck style={{marginRight:4}} /></span> {item}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 12 }}>
          <div style={{ fontSize: 20 }}><FaExclamationTriangle style={{marginRight:4}} /></div>
          <div>
            <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Restore Process</div>
            <div style={{ fontSize: 13, color: '#9aa3b2', lineHeight: 1.6 }}>
              Restore requires importing the JSON file via Prisma CLI or a migration script. Automated restore UI is planned for a future release.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

