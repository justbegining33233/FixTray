'use client';

import { useEffect, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { formatPermissionLabel } from '@/lib/permissionLabels';

interface TechPermissions {
  techId: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
}

export default function TeamPermissionsTable({ readOnly = false }: { readOnly?: boolean }) {
  const [techs, setTechs] = useState<TechPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/permissions', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTechs(data.techs || []);
        setAllPermissions(data.allPermissions || []);
        setError(null);
      } else {
        setError('Could not load permissions.');
      }
    } catch {
      setError('Could not load permissions.');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (techId: string, permission: string, currentValue: boolean) => {
    if (readOnly) return;
    setSaving(techId + permission);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ techId, permissions: { [permission]: !currentValue } }),
      });
      if (res.ok) {
        setTechs((prev) => prev.map((tech) => (
          tech.techId === techId
            ? { ...tech, permissions: { ...tech.permissions, [permission]: !currentValue } }
            : tech
        )));
        setToast('Permission updated');
        setTimeout(() => setToast(null), 2000);
      }
    } catch {
      /* keep previous state */
    } finally {
      setSaving(null);
    }
  };

  const formatPerm = formatPermissionLabel;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading permissions...</div>;
  }

  if (error) {
    return <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, color: '#fca5a5' }}>{error}</div>;
  }

  if (techs.length === 0) {
    return (
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
        <div style={{ color: '#6b7280' }}>No team members found. Add team members first.</div>
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: 24, background: '#052e16', color: '#22c55e', padding: '12px 20px', borderRadius: 8, border: '1px solid #16a34a', zIndex: 50, fontSize: 14 }}>
          <FaCheckCircle style={{ marginRight: 4 }} /> {toast}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: '14px 16px', color: '#9ca3af', fontSize: 13, fontWeight: 500, position: 'sticky', left: 0, background: '#1e293b', minWidth: 180 }}>
                Permission
              </th>
              {techs.map((tech) => (
                <th key={tech.techId} style={{ textAlign: 'center', padding: '14px 12px', color: '#e5e7eb', fontSize: 13 }}>
                  <div>{tech.name}</div>
                  <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 400, textTransform: 'capitalize' }}>{tech.role}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPermissions.map((perm) => (
              <tr key={perm} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '10px 16px', color: '#e5e7eb', fontSize: 13, position: 'sticky', left: 0, background: '#1e293b' }}>
                  {formatPerm(perm)}
                </td>
                {techs.map((tech) => {
                  const val = tech.permissions[perm] ?? false;
                  const isSaving = saving === tech.techId + perm;
                  return (
                    <td key={tech.techId} style={{ textAlign: 'center', padding: '10px 12px' }}>
                      <button
                        type="button"
                        aria-label={`${formatPerm(perm)} for ${tech.name}`}
                        aria-pressed={val}
                        onClick={() => togglePermission(tech.techId, perm, val)}
                        disabled={isSaving || readOnly}
                        style={{
                          width: 36, height: 20, borderRadius: 10, border: 'none',
                          cursor: readOnly ? 'default' : 'pointer',
                          background: val ? '#16a34a' : '#374151', position: 'relative',
                          opacity: isSaving || readOnly ? 0.6 : 1,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 2, left: val ? 18 : 2, width: 16, height: 16,
                          borderRadius: '50%', background: '#fff',
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
    </div>
  );
}
