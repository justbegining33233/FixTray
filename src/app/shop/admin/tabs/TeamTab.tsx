'use client';

import Link from 'next/link';
import { FaClock, FaEnvelope, FaPhone, FaUserCog, FaUsers, FaWrench } from 'react-icons/fa';

interface TeamTabProps {
  teamData: any[];
}

export default function TeamTab({ teamData }: TeamTabProps) {
  const totalMembers = teamData.length;
  const clockedIn = teamData.filter((m: any) => m.isClockedIn).length;
  const managers = teamData.filter((m: any) => m.role === 'manager').length;
  const totalHours = teamData.reduce((sum: number, m: any) => sum + (m.weeklyHours || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: '#e5e7eb', fontSize: 24, margin: 0 }}>Team Management</h2>
          <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>Staffing visibility, active shifts, and quick profile access.</div>
        </div>
        <Link
          href="/shop/manage-team"
          style={{
            padding: '10px 16px',
            background: 'rgba(229,51,42,0.2)',
            color: '#ff6b64',
            border: '1px solid rgba(229,51,42,0.3)',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Add Team Member
        </Link>
      </div>

      <div style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Total Members</div>
          <div style={{ color: '#ff6b64', fontSize: 24, fontWeight: 800 }}>{totalMembers}</div>
        </div>
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Clocked In</div>
          <div style={{ color: '#22c55e', fontSize: 24, fontWeight: 800 }}>{clockedIn}</div>
        </div>
        <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Weekly Hours</div>
          <div style={{ color: '#a78bfa', fontSize: 24, fontWeight: 800 }}>{totalHours.toFixed(1)}</div>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Managers</div>
          <div style={{ color: '#f59e0b', fontSize: 24, fontWeight: 800 }}>{managers}</div>
        </div>
      </div>

      {teamData.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: '#9aa3b2' }}><FaUsers /></div>
          <div style={{ color: '#9aa3b2', fontSize: 16 }}>No team members found</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {teamData.map((member: any) => (
            <div
              key={member.id}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: member.isClockedIn ? '1px solid rgba(34,197,94,0.45)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: member.role === 'manager' ? 'rgba(139,92,246,0.2)' : 'rgba(229,51,42,0.2)',
                        color: member.role === 'manager' ? '#a78bfa' : '#ff6b64',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                      }}
                    >
                      {member.role === 'manager' ? <FaUserCog /> : <FaWrench />}
                    </div>
                    <div>
                      <div style={{ color: '#e5e7eb', fontSize: 17, fontWeight: 700 }}>{member.name}</div>
                      <div style={{ color: '#9aa3b2', fontSize: 12 }}>{member.role === 'manager' ? 'Manager' : 'Technician'}</div>
                    </div>
                  </div>
                  {member.isClockedIn && <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Currently clocked in</div>}
                  <div style={{ color: '#9aa3b2', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><FaEnvelope /> {member.email}</div>
                  <div style={{ color: '#9aa3b2', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><FaPhone /> {member.phone || 'No phone'}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#9aa3b2', fontSize: 11, marginBottom: 4 }}>Weekly Hours</div>
                  <div style={{ color: '#ff6b64', fontWeight: 800, fontSize: 20 }}>{(member.weeklyHours || 0).toFixed(1)}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#9aa3b2', fontSize: 11, marginBottom: 4 }}>Hourly Rate</div>
                  <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 18 }}>${member.hourlyRate || 0}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Link
                  href={`/shop/admin/employee/${member.id}`}
                  style={{
                    padding: '8px 14px',
                    background: 'rgba(229,51,42,0.2)',
                    color: '#ff6b64',
                    border: '1px solid rgba(229,51,42,0.3)',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  View Profile
                </Link>
                <div style={{ color: '#9aa3b2', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FaClock /> Last active: {member.lastActive ? new Date(member.lastActive).toLocaleDateString() : 'Never'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

