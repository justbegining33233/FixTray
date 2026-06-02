'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCircle, FaEnvelope, FaFolder, FaPhone, FaUsers } from 'react-icons/fa';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
  assignedJobs: number;
  joinedDate: string;
}

export default function ManagerTeamPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    loadTeamMembers();
  }, [user]);

  async function loadTeamMembers() {
    setLoadingTeam(true);
    try {
      const token = localStorage.getItem('token');
      const shopId = localStorage.getItem('shopId');
      if (!shopId) return;

      const res = await fetch(`/api/techs?shopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const techs = data.techs || [];
        setTeamMembers(
          techs.map((t: any) => ({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`,
            role: t.role || 'tech',
            email: t.email || '',
            phone: t.phone || '',
            status: t.clockedIn ? 'Clocked In' : 'Off',
            assignedJobs: t.assignedJobs ?? 0,
            joinedDate: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ' - ',
          }))
        );
      }
    } catch (e) {
      console.error('Error loading team:', e);
    } finally {
      setLoadingTeam(false);
    }
  }

  const roleColors: Record<string, { bg: string; color: string }> = {
    tech:    { bg: 'rgba(229,51,42,0.2)',  color: '#ffb4ad' },
    manager: { bg: 'rgba(139,92,246,0.2)',  color: '#c4b5fd' },
    advisor: { bg: 'rgba(234,179,8,0.2)',   color: '#fde047' },
    shop:    { bg: 'rgba(34,197,94,0.2)',   color: '#86efac' },
  };

  const filtered = teamMembers.filter(
    m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        Loading...
      </div>
    );
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#e5e7eb', display: 'flex' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton={true} />

        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Breadcrumbs />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Team Overview</h1>
              <p style={{ color: '#94a3b8', marginTop: '4px' }}>View your team's status and assigned work</p>
            </div>
            <span style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '6px 14px', color: '#94a3b8', fontSize: '0.85rem' }}>
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search by name or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', maxWidth: '360px', padding: '10px 14px',
                background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                color: '#e5e7eb', fontSize: '0.9rem', outline: 'none',
              }}
            />
          </div>

          {/* Team grid */}
          {loadingTeam ? (
            <p style={{ color: '#94a3b8' }}>Loading team...</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}><FaUsers style={{marginRight:4}} /></div>
              <p style={{ fontSize: '1.1rem' }}>No team members found.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {filtered.map(member => (
                <div
                  key={member.id}
                  style={{
                    background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
                    padding: '20px',
                  }}
                >
                  {/* Avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div style={{
                      width: '46px', height: '46px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #e5332a, #6366f1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f9', fontSize: '1rem' }}>{member.name}</p>
                      <span style={{
                        fontSize: '0.75rem', padding: '2px 8px', borderRadius: '9999px',
                        background: roleColors[member.role]?.bg ?? 'rgba(100,116,139,0.2)',
                        color: roleColors[member.role]?.color ?? '#94a3b8',
                      }}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.78rem', padding: '3px 10px', borderRadius: '9999px',
                      background: member.status === 'Clocked In' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.2)',
                      color: member.status === 'Clocked In' ? '#4ade80' : '#94a3b8',
                    }}>
                      <FaCircle style={{marginRight:4}} /> {member.status}
                    </span>
                    <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(229,51,42,0.15)', color: '#ff6b64' }}>
                      <FaFolder style={{marginRight:4}} /> {member.assignedJobs} job{member.assignedJobs !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Contact info */}
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {member.email && (
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                        <FaEnvelope style={{marginRight:4}} /> {member.email}
                      </p>
                    )}
                    {member.phone && (
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                        <FaPhone style={{marginRight:4}} /> {member.phone}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                      Joined {member.joinedDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


