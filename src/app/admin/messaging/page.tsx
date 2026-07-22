'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaComments, FaUsers, FaEnvelope, FaClock, FaArrowRight } from 'react-icons/fa';

interface Conversation {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  receiverRole: string;
  subject?: string;
  body: string;
  unreadCount: number;
  lastMessageAt: string;
  isRead: boolean;
}

interface MessageStats {
  totalConversations: number;
  unreadMessages: number;
  activeUsers: number;
  messagesSent24h: number;
  avgResponseTime: number;
}

export default function AdminMessagingPage() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadMessages();
    const interval = setInterval(loadMessages, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [user]);

  const loadMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      
      setConversations(data.conversations || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = filterUnread
    ? conversations.filter(c => c.unreadCount > 0)
    : conversations;

  const roleColors: Record<string, string> = {
    shop: '#3b82f6',
    tech: '#22c55e',
    customer: '#ec4899',
    manager: '#f59e0b',
    admin: '#e5332a',
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e5e7eb', margin: '0 0 8px' }}>
              <FaComments style={{ marginRight: 12, verticalAlign: 'middle' }} />
              Messaging Overview
            </h1>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Monitor platform communications</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 16, marginBottom: 24, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Stats Grid */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Conversations', value: stats.totalConversations, icon: <FaComments />, color: '#3b82f6' },
                { label: 'Unread Messages', value: stats.unreadMessages, icon: <FaEnvelope />, color: '#f59e0b' },
                { label: 'Active Users', value: stats.activeUsers, icon: <FaUsers />, color: '#22c55e' },
                { label: 'Messages (24h)', value: stats.messagesSent24h, icon: <FaArrowRight />, color: '#ec4899' },
              ].map((stat, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ color: stat.color, fontSize: 20 }}>{stat.icon}</span>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{stat.label}</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Unread Filter */}
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setFilterUnread(!filterUnread)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${filterUnread ? '#e5332a' : 'rgba(255,255,255,0.1)'}`,
                background: filterUnread ? 'rgba(229,51,42,0.15)' : 'rgba(0,0,0,0.3)',
                color: filterUnread ? '#e5332a' : '#9ca3af',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {filterUnread ? '✓ Showing Unread Only' : 'Show All Conversations'}
            </button>
          </div>

          {/* Conversations List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              No conversations
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    borderLeft: conv.unreadCount > 0 ? '4px solid #e5332a' : '4px solid transparent',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div>
                        <span style={{
                          background: `${roleColors[conv.senderRole] || '#9ca3af'}20`,
                          color: roleColors[conv.senderRole] || '#9ca3af',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                        }}>
                          {conv.senderRole.toUpperCase()}
                        </span>
                        <span style={{ marginLeft: 8, marginRight: 8, color: '#6b7280' }}>→</span>
                        <span style={{
                          background: `${roleColors[conv.receiverRole] || '#9ca3af'}20`,
                          color: roleColors[conv.receiverRole] || '#9ca3af',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                        }}>
                          {conv.receiverRole.toUpperCase()}
                        </span>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span style={{
                          background: '#e5332a',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {conv.unreadCount} unread
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>
                      {conv.senderName} to {conv.receiverName}
                    </div>
                    {conv.subject && (
                      <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>
                        Subject: {conv.subject}
                      </div>
                    )}
                    <div style={{ color: '#9ca3af', fontSize: 12, maxWidth: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.body}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 150 }}>
                    <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
                      <FaClock style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {new Date(conv.lastMessageAt).toLocaleString()}
                    </div>
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
