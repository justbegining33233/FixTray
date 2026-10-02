'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaComments, FaUsers, FaEnvelope, FaClock, FaArrowRight } from 'react-icons/fa';
import { messageListPreview } from '@/lib/messageAttachment';

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
  displayBody?: string;
  unreadCount: number;
  lastMessageAt: string;
  isRead: boolean;
  replyTo?: ReplyTarget;
  canReply?: boolean;
  messages?: ThreadMessage[];
}

interface ThreadMessage {
  id: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  body?: string;
  createdAt: string;
}

interface ReplyTarget {
  id: string;
  role: string;
  name: string;
}

interface ShopAlert {
  id: string;
  kind: string;
  label: string;
  senderName: string;
  receiverName: string;
  subject?: string | null;
  preview: string;
  lastMessageAt: string;
  canReply: false;
}

interface MessageStats {
  totalConversations: number;
  unreadMessages: number;
  activeUsers: number;
  messagesSent24h: number;
  avgResponseTime: number;
  shopAlerts?: number;
}

export default function AdminMessagingPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);
  const [alerts, setAlerts] = useState<ShopAlert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

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
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
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
  const selected = conversations.find((conversation) => conversation.id === selectedId) || null;

  const sendReply = async () => {
    if (!selected?.replyTo || !reply.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: selected.replyTo.id,
          receiverRole: selected.replyTo.role,
          receiverName: selected.replyTo.name,
          messageBody: reply.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Reply was not sent');
      }
      setReply('');
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply was not sent');
    } finally {
      setSending(false);
    }
  };

  const roleColors: Record<string, string> = {
    shop: '#3b82f6',
    tech: '#22c55e',
    customer: '#ec4899',
    manager: '#f59e0b',
    admin: '#e5332a',
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
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
              {say("Messaging Overview")}{' '}</h1>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>{say("Monitor platform communications")}</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 16, marginBottom: 24, color: '#fca5a5' }}>
              {say(error)}
            </div>
          )}

          {/* Stats Grid */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {[
                { label: say("Conversations"), value: stats.totalConversations, icon: <FaComments />, color: '#3b82f6' },
                { label: say("Unread Messages"), value: stats.unreadMessages, icon: <FaEnvelope />, color: '#f59e0b' },
                { label: say("Active Users"), value: stats.activeUsers, icon: <FaUsers />, color: '#22c55e' },
                { label: say("Messages (24h)"), value: stats.messagesSent24h, icon: <FaArrowRight />, color: '#ec4899' },
              ].map((stat, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ color: stat.color, fontSize: 20 }}>{say(stat.icon)}</span>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{say(stat.label)}</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{say(stat.value)}</div>
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
              {filterUnread ? say("✓ Showing Unread Only") : say("Show All Conversations")}
            </button>
          </div>

          {/* Conversations List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>{say("Loading conversations...")}</div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              {say("No conversations")}{' '}</div>
          ) : (
            <>
            <h2 style={{ color: '#e5e7eb', fontSize: 18, margin: '0 0 12px' }}>{say("Messages to staff")}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedId(conv.id)}
                  style={{
                    background: selectedId === conv.id ? 'rgba(229,51,42,0.12)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    borderLeft: conv.unreadCount > 0 ? '4px solid #e5332a' : '4px solid transparent',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
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
                          {say(conv.unreadCount)} unread
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>
                      {say(conv.senderName)} to {say(conv.receiverName)}
                    </div>
                    {conv.subject && (
                      <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 4 }}>
                        {say("Subject:")}{' '}{say(conv.subject)}
                      </div>
                    )}
                    <div style={{ color: '#9ca3af', fontSize: 12, maxWidth: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {messageListPreview(conv.displayBody || conv.body) === 'Photo'
                        ? say('Photo')
                        : messageListPreview(conv.displayBody || conv.body)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 150 }}>
                    <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
                      <FaClock style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {new Date(conv.lastMessageAt).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            </>
          )}

          {selected && (
            <section style={{ marginTop: 24, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20 }}>
              <h2 style={{ color: '#e5e7eb', fontSize: 18, margin: '0 0 12px' }}>{say(selected.senderName)}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {(selected.messages || []).length === 0 ? (
                  <div style={{ color: '#9ca3af' }}>{say("No messages in this thread")}</div>
                ) : (selected.messages || []).map((message) => (
                  <div key={message.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
                    <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {say(message.senderName || '')}{' '}
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>{message.senderRole}</span>
                    </div>
                    <div style={{ color: '#d1d5db', fontSize: 14, whiteSpace: 'pre-wrap' }}>{message.body}</div>
                  </div>
                ))}
              </div>
              {selected.canReply !== false && selected.replyTo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: '#9ca3af', fontSize: 13 }}>{say("Reply")}</label>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={say("Type a reply")}
                    rows={3}
                    style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#000', color: '#e5e7eb', padding: 12, fontSize: 14 }}
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    style={{ alignSelf: 'flex-start', padding: '10px 16px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 700, cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer' }}
                  >
                    {say("Send Message")}
                  </button>
                </div>
              )}
            </section>
          )}

          {alerts.length > 0 && (
            <section style={{ marginTop: 32 }}>
              <h2 style={{ color: '#e5e7eb', fontSize: 18, margin: '0 0 8px' }}>{say("Shop alerts are not messages to staff.")}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((alert) => (
                  <div key={alert.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 16 }}>
                    <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{say(alert.label)}</div>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>{say(alert.senderName)} to {say(alert.receiverName)}</div>
                    <div style={{ color: '#9ca3af', fontSize: 13 }}>{alert.preview}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
