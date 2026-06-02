'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';

interface TechPermissions {
  techId: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
}

export default function PermissionsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [techs, setTechs] = useState<TechPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchPermissions();
  }, [user]);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/permissions', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTechs(data.techs || []);
        setAllPermissions(data.allPermissions || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const togglePermission = async (techId: string, permission: string, currentValue: boolean) => {
    setSaving(techId + permission);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ techId, permissions: { [permission]: !currentValue } }),
      });
      if (res.ok) {
        setTechs(prev => prev.map(t =>
          t.techId === techId ? { ...t, permissions: { ...t.permissions, [permission]: !currentValue } } : t
        ));
        setToast('Permission updated');
        setTimeout(() => setToast(null), 2000);
      }
    } catch {}
    finally { setSaving(null); }
  };

  const formatPerm = (perm: string) =>
    perm
      .split('.')
      .map((part) => part.replace(/(^|\s)\S/g, t => t.toUpperCase()))
      .join(', ');

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 24 }}>
            <Link href="/shop/manage-team" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> Manage Team</Link>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>Team Permissions</h1>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Control what each team member can access</p>
          </div>

          {toast && (
            <div style={{ position: 'fixed', top: 80, right: 24, background: '#052e16', color: '#22c55e', padding: '12px 20px', borderRadius: 8, border: '1px solid #16a34a', zIndex: 50, fontSize: 14 }}>
              <FaCheckCircle style={{marginRight:4}} /> {toast}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading permissions...</div>
          ) : techs.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
              <div style={{ color: '#6b7280' }}>No team members found. Add team members first.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #334155' }}>
                    <th style={{ textAlign: 'left', padding: '14px 16px', color: '#9ca3af', fontSize: 13, fontWeight: 500, position: 'sticky', left: 0, background: '#1e293b', minWidth: 180 }}>
                      Permission
                    </th>
                    {techs.map(tech => (
                      <th key={tech.techId} style={{ textAlign: 'center', padding: '14px 12px', color: '#e5e7eb', fontSize: 13 }}>
                        <div>{tech.name}</div>
                        <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 400, textTransform: 'capitalize' }}>{tech.role}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPermissions.map(perm => (
                    <tr key={perm} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 16px', color: '#e5e7eb', fontSize: 13, position: 'sticky', left: 0, background: '#1e293b' }}>
                        {formatPerm(perm)}
                      </td>
                      {techs.map(tech => {
                        const val = tech.permissions[perm] ?? false;
                        const isSaving = saving === tech.techId + perm;
                        return (
                          <td key={tech.techId} style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <button
                              onClick={() => togglePermission(tech.techId, perm, val)}
                              disabled={isSaving}
                              style={{
                                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: val ? '#16a34a' : '#374151', position: 'relative', transition: 'background 0.2s',
                                opacity: isSaving ? 0.5 : 1,
                              }}
                            >
                              <span style={{
                                position: 'absolute', top: 2, left: val ? 18 : 2, width: 16, height: 16,
                                borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                              }} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


