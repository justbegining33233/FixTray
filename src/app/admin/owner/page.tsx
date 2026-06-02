'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';

type SectionKey = 'profile' | 'quick-edit' | 'reset-password';

type UserRow = {
  id: string;
  userType: 'admin' | 'shop' | 'customer' | 'manager' | 'tech';
  username?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status?: string;
  capabilities?: {
    canEditRole: boolean;
    canEditStatus: boolean;
    canEditUsername: boolean;
  };
};

function OwnerControlCenterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);

  const [section, setSection] = useState<SectionKey>('profile');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', username: '', email: '', role: 'customer', status: 'active' });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isOwnerProfile = Boolean(user?.isOwner);

  useEffect(() => {
    if (!isLoading && user && !isOwnerProfile) {
      router.replace('/admin/home' as Route);
    }
  }, [isLoading, user, isOwnerProfile, router]);

  useEffect(() => {
    const raw = (searchParams?.get('section') || 'profile').toLowerCase();
    if (raw === 'quick-edit' || raw === 'reset-password' || raw === 'profile') {
      setSection(raw as SectionKey);
    } else {
      setSection('profile');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isOwnerProfile) return;
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set('q', query.trim());
      }

      setIsSearchingUsers(true);
      fetch(`/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`, { credentials: 'include', signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.users || [];
          setUsers(list);
        })
        .catch(() => {})
        .finally(() => setIsSearchingUsers(false));
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOwnerProfile, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return users.filter((u) =>
      [u.firstName, u.lastName, u.username, u.email, u.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [users, query]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as UserRow[];
    return users.filter((u) => {
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      return [fullName, u.username, u.email, u.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    }).slice(0, 8);
  }, [users, query]);

  const pickSuggestion = (u: UserRow) => {
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    setQuery(fullName || u.username || u.email);
    if (section === 'reset-password') {
      selectUserForReset(u);
      return;
    }
    selectUserForEdit(u);
  };

  const openSection = (next: SectionKey) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('section', next);
    router.replace(`/admin/owner?${params.toString()}` as Route, { scroll: false });
    setSection(next);
    setMessage('');
  };

  const selectUserForEdit = (u: UserRow) => {
    setSelected(u);
    setEditForm({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      username: u.username || '',
      email: u.email || '',
      role: u.role || 'customer',
      status: u.status || 'active',
    });
    setMessage('');
  };

  const selectUserForReset = (u: UserRow) => {
    setSelected(u);
    setNewPassword('');
    setMessage('');
  };

  const saveUserEdit = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: selected.id,
          userType: selected.userType,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          ...(selected.capabilities?.canEditUsername ? { username: editForm.username } : {}),
          ...(selected.capabilities?.canEditRole ? { role: editForm.role } : {}),
          ...(selected.capabilities?.canEditStatus ? { status: editForm.status } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Failed to update user.');
        return;
      }

      setUsers((prev) => prev.map((u) => u.id === selected.id ? {
        ...u,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        username: selected.capabilities?.canEditUsername ? editForm.username : u.username,
        email: editForm.email,
        role: selected.capabilities?.canEditRole ? editForm.role : u.role,
        status: selected.capabilities?.canEditStatus ? editForm.status : u.status,
      } : u));
      setMessage('User information updated.');
    } finally {
      setSaving(false);
    }
  };

  const resetUserPassword = async () => {
    if (!selected) return;
    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selected.id,
          userType: selected.userType,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Failed to reset password.');
        return;
      }

      setNewPassword('');
      setMessage('Password reset successfully.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!isOwnerProfile) {
    return (
      <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Redirecting...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>
        <Link href={'/admin/home' as Route} style={{ color: '#ffb4ad', textDecoration: 'none', fontSize: 14 }}>
          Back to Admin Home
        </Link>

        <div style={{ marginTop: 14, background: '#000000', border: '1px solid #1f2937', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, color: '#f8fafc' }}>Owner Control Center</h1>
              <p style={{ marginTop: 8, color: '#94a3b8', fontSize: 14 }}>Personal tools for SupAdm1006 only.</p>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.35)', color: '#fdba74', fontSize: 12, fontWeight: 700 }}>
              FixTray Owner Access
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 18, marginTop: 20 }}>
            <div style={{ minWidth: 0 }}>
              {section === 'profile' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>My Profile</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>Owner account information and platform details.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Username</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{user.name}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 14 }}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Role</div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>Owner Super Admin</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 14 }}>
                    <div style={{ color: '#86efac', fontWeight: 700, marginBottom: 6 }}>Important FixTray Information</div>
                    <div style={{ color: '#cbd5e1', fontSize: 14 }}>
                      This owner menu controls sensitive account tools and should not be visible for other users or profiles.
                    </div>
                  </div>
                </div>
              )}

              {section === 'quick-edit' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>Quick Edit User Info</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>Select a user, edit their details, and save instantly.</p>

                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, email, username, role"
                    style={{ width: '100%', maxWidth: 560, padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', marginBottom: 12 }}
                  />

                  {query.trim() && (
                    <div style={{ width: '100%', maxWidth: 560, marginBottom: 12, border: '1px solid #1f2937', borderRadius: 10, background: '#020617', overflow: 'hidden' }}>
                      {suggestions.length === 0 ? (
                        <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 13 }}>
                          {isSearchingUsers ? 'Searching users...' : 'No matching users found'}
                        </div>
                      ) : (
                        suggestions.map((u) => {
                          const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || 'Unnamed user';
                          return (
                            <button
                              key={`suggestion-quick-${u.id}`}
                              onClick={() => pickSuggestion(u)}
                              style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{fullName}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>{u.email}</div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, maxHeight: 460, overflow: 'auto' }}>
                      {!query.trim() ? (
                        <div style={{ padding: 14 }}>
                          <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Users</div>
                          <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>Type a name above to search users.</div>
                        </div>
                      ) : (
                        filtered.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => selectUserForEdit(u)}
                            style={{ width: '100%', textAlign: 'left', padding: 12, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', background: selected?.id === u.id ? 'rgba(37,99,235,0.15)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                          >
                            <div style={{ fontWeight: 700 }}>{[u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || 'Unnamed user'}</div>
                            {u.username && <div style={{ fontSize: 12, color: '#a5b4fc' }}>@{u.username}</div>}
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{u.email}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{u.role}</div>
                          </button>
                        ))
                      )}
                    </div>

                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 12 }}>
                      {!query.trim() ? (
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>User Info</div>
                          <div style={{ color: '#64748b', marginTop: 8 }}>User details will appear here after search and selection.</div>
                        </div>
                      ) : !selected ? (
                        <div style={{ color: '#94a3b8' }}>Select a user to edit.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <input value={editForm.firstName} onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))} placeholder="First name" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                          <input value={editForm.lastName} onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))} placeholder="Last name" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                          <input value={editForm.username} onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))} placeholder="Username" disabled={!selected.capabilities?.canEditUsername} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: !selected.capabilities?.canEditUsername ? '#000000' : '#020617', color: '#e2e8f0', opacity: selected.capabilities?.canEditUsername ? 1 : 0.7 }} />
                          <input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }} />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} disabled={!selected.capabilities?.canEditRole} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: !selected.capabilities?.canEditRole ? '#000000' : '#020617', color: '#e2e8f0', opacity: selected.capabilities?.canEditRole ? 1 : 0.7 }}>
                              <option value="admin">admin</option>
                              <option value="shop">shop</option>
                              <option value="manager">manager</option>
                              <option value="tech">tech</option>
                              <option value="customer">customer</option>
                            </select>
                            <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} disabled={!selected.capabilities?.canEditStatus} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: !selected.capabilities?.canEditStatus ? '#000000' : '#020617', color: '#e2e8f0', opacity: selected.capabilities?.canEditStatus ? 1 : 0.7 }}>
                              <option value="active">active</option>
                              <option value="pending">pending</option>
                              <option value="suspended">suspended</option>
                            </select>
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            {!selected.capabilities?.canEditRole && !selected.capabilities?.canEditStatus && !selected.capabilities?.canEditUsername
                              ? 'This account only supports name and email updates from the owner tools.'
                              : !selected.capabilities?.canEditStatus
                                ? 'Status changes are only persisted for shop accounts.'
                                : 'Fields are enabled only when the backing user type supports them.'}
                          </div>
                          <button onClick={saveUserEdit} disabled={saving} style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                            {saving ? 'Saving...' : 'Save User Changes'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {section === 'reset-password' && (
                <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 22 }}>Reset User Password</h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>Select a user and set a temporary password.</p>

                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search user"
                    style={{ width: '100%', maxWidth: 560, padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', marginBottom: 12 }}
                  />

                  {query.trim() && (
                    <div style={{ width: '100%', maxWidth: 560, marginBottom: 12, border: '1px solid #1f2937', borderRadius: 10, background: '#020617', overflow: 'hidden' }}>
                      {suggestions.length === 0 ? (
                        <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 13 }}>
                          {isSearchingUsers ? 'Searching users...' : 'No matching users found'}
                        </div>
                      ) : (
                        suggestions.map((u) => {
                          const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || 'Unnamed user';
                          return (
                            <button
                              key={`suggestion-reset-${u.id}`}
                              onClick={() => pickSuggestion(u)}
                              style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{fullName}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>{u.email}</div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, maxHeight: 460, overflow: 'auto' }}>
                      {!query.trim() ? (
                        <div style={{ padding: 14 }}>
                          <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Users</div>
                          <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>Type a name above to search users.</div>
                        </div>
                      ) : (
                        filtered.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => selectUserForReset(u)}
                            style={{ width: '100%', textAlign: 'left', padding: 12, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', background: selected?.id === u.id ? 'rgba(124,58,237,0.15)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                          >
                            <div style={{ fontWeight: 700 }}>{[u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || 'Unnamed user'}</div>
                            {u.username && <div style={{ fontSize: 12, color: '#c4b5fd' }}>@{u.username}</div>}
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{u.email}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{u.role}</div>
                          </button>
                        ))
                      )}
                    </div>

                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 12 }}>
                      {!query.trim() ? (
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>User Info</div>
                          <div style={{ color: '#64748b', marginTop: 8 }}>User details will appear here after search and selection.</div>
                        </div>
                      ) : !selected ? (
                        <div style={{ color: '#94a3b8' }}>Select a user to reset password.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ fontSize: 13, color: '#cbd5e1' }}>
                            Selected: <strong>{[selected.firstName, selected.lastName].filter(Boolean).join(' ').trim() || selected.username || selected.email}</strong>
                          </div>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password (minimum 8 characters)"
                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#e2e8f0' }}
                          />
                          <button onClick={resetUserPassword} disabled={saving} style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                            {saving ? 'Resetting...' : 'Reset Password'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div style={{ marginTop: 12, fontSize: 13, color: message.toLowerCase().includes('success') || message.toLowerCase().includes('updated') ? '#4ade80' : '#fda4af' }}>
                  {message}
                </div>
              )}
            </div>

            <div>
              <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 12, padding: 12, position: 'sticky', top: 24 }}>
                <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Menu</div>
                <button onClick={() => openSection('profile')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'profile' ? '1px solid rgba(229,51,42,0.45)' : '1px solid transparent', background: section === 'profile' ? 'rgba(229,51,42,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  My Profile
                </button>
                <button onClick={() => openSection('quick-edit')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'quick-edit' ? '1px solid rgba(229,51,42,0.45)' : '1px solid transparent', background: section === 'quick-edit' ? 'rgba(229,51,42,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer', marginBottom: 8 }}>
                  Quick Edit User Info
                </button>
                <button onClick={() => openSection('reset-password')} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: section === 'reset-password' ? '1px solid rgba(124,58,237,0.45)' : '1px solid transparent', background: section === 'reset-password' ? 'rgba(124,58,237,0.14)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>
                  Reset User Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerControlCenterPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#000000', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading...
        </div>
      }
    >
      <OwnerControlCenterPageContent />
    </Suspense>
  );
}



