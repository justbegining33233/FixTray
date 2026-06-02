'use client';

import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaComments, FaExclamationTriangle, FaShieldAlt, FaStore, FaUser, FaUserTie, FaWrench } from 'react-icons/fa';
import { useSocket } from '@/lib/socket';

// --- Types --------------------------------------------------------------------

interface Message {
  id: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  receiverId: string;
  receiverRole: string;
  receiverName: string;
  subject?: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  contactId: string;
  contactRole: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
  shopId?: string;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  shopId: string;
  contextLabel: string;
}

interface MessagingCardProps {
  userId: string;
  shopId: string;
}

// --- Constants ----------------------------------------------------------------

const ROLE_ICON: Record<string, React.ReactNode> = { customer: <FaUser />, tech: <FaWrench />, manager: <FaUserTie />, shop: <FaStore />, admin: <FaShieldAlt />, superadmin: <FaShieldAlt /> };
const ROLE_LABEL: Record<string, string> = { customer: 'Customer', tech: 'Tech', manager: 'Manager', shop: 'Shop', admin: 'FixTray Employee', superadmin: 'Super Admin' };
const ROLE_COLOR: Record<string, string> = { customer: '#3b82f6', tech: '#10b981', manager: '#8b5cf6', shop: '#f59e0b', admin: '#ef4444', superadmin: '#f43f5e' };

type TabKey = 'all' | 'customer' | 'shop' | 'tech' | 'manager' | 'admin' | 'superadmin';
const ROLE_FILTERS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'customer', label: 'Customers' },
  { key: 'shop', label: 'Shops' },
  { key: 'manager', label: 'Managers' },
  { key: 'tech', label: 'Techs' },
  { key: 'admin', label: 'Employees' },
  { key: 'superadmin', label: 'Super Admin' },
];

// --- Component ----------------------------------------------------------------

export default function MessagingCard({ userId, shopId }: MessagingCardProps) {
  const { on, off } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [msgMsg, setMsgMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [newRecipient, setNewRecipient] = useState<Contact | null>(null);
  const [composeRoleFilter, setComposeRoleFilter] = useState<TabKey>('all');
  const [contactsLoading, setContactsLoading] = useState(false);

  // Conversations filtered by active tab
  const filteredConversations = useMemo(() => {
    if (activeTab === 'all') return conversations;
    return conversations.filter((c) => c.contactRole === activeTab);
  }, [conversations, activeTab]);

  // Unread counts per tab
  const unreadByTab = useMemo(() => {
    const counts: Record<string, number> = { all: 0, customer: 0, shop: 0, tech: 0, manager: 0, admin: 0, superadmin: 0 };
    for (const c of conversations) {
      counts.all += c.unreadCount;
      if (counts[c.contactRole] !== undefined) counts[c.contactRole] += c.unreadCount;
    }
    return counts;
  }, [conversations]);

  const filteredAvailableContacts = useMemo(() => {
    if (composeRoleFilter === 'all') return availableContacts;
    return availableContacts.filter((c) => c.role === composeRoleFilter);
  }, [availableContacts, composeRoleFilter]);

  // Auto-scroll to the bottom whenever thread messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  // Poll the active thread every 30s as fallback; socket events trigger immediate refresh
  useEffect(() => {
    if (!selectedConversation) return;
    const interval = setInterval(() => fetchThread(selectedConversation), 30000);
    return () => clearInterval(interval);
     
  }, [selectedConversation?.contactId, selectedConversation?.contactRole]);

  useEffect(() => {
    if (userId) {
      fetchMessages();
    }
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
     
  }, [shopId, userId]);

  // Listen for real-time new-message events from Socket.IO
  useEffect(() => {
    const handleNewMessage = () => {
      fetchMessages();
      if (selectedConversationRef.current) {
        fetchThread(selectedConversationRef.current);
      }
    };
    on('new-message', handleNewMessage);
    return () => { off('new-message', handleNewMessage); };
  }, [on, off]);

  // Keep ref in sync with state so stale-closure polls can read the current selection
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // --- API helpers ------------------------------------------------------------

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { setAuthError(true); return; }
      const res = await fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { setAuthError(true); return; }
      if (res.ok) {
        const { conversations: convs } = await res.json();
        setConversations(convs ?? []);
        setAuthError(false);
        // keep selected in sync (metadata only  -  full messages come from fetchThread)
        const current = selectedConversationRef.current;
        if (current) {
          const updated = (convs ?? []).find(
            (c: Conversation) => c.contactId === current.contactId && c.contactRole === current.contactRole,
          );
          if (updated) setSelectedConversation(updated);
        }
      }
    } catch { /* silent */ }
  };

  // Fetch the COMPLETE message history for a specific conversation (no limit)
  const fetchThread = async (conv: Conversation) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const params = new URLSearchParams({ contactId: conv.contactId, role: conv.contactRole });
      const res = await fetch(`/api/messages?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const convData = (data.conversations || []).find(
          (c: Conversation) => c.contactId === conv.contactId && c.contactRole === conv.contactRole,
        );
        setThreadMessages(convData?.messages ?? []);
      }
    } catch { /* silent */ }
  };

  const fetchAvailableContacts = async () => {
    setContactsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/messages/contacts', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const { contacts } = await res.json();
        setAvailableContacts(contacts ?? []);
      }
    } catch { /* silent */ }
    finally { setContactsLoading(false); }
  };

  const markAsRead = async (conv: Conversation) => {
    if (!conv.unreadCount) return;
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contactId: conv.contactId, contactRole: conv.contactRole }),
      });
      fetchMessages();
    } catch { /* silent */ }
  };

  // --- Actions ----------------------------------------------------------------

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setThreadMessages(conv.messages ?? []);  // Show existing messages immediately
    setShowCompose(false);
    markAsRead(conv);
    fetchThread(conv);  // Then load full history (replaces once response arrives)
  };

  const handleSendMessage = async () => {
    const target = showCompose
      ? (newRecipient ? { contactId: newRecipient.id, contactRole: newRecipient.role, contactName: newRecipient.name } : null)
      : selectedConversation
        ? { contactId: selectedConversation.contactId, contactRole: selectedConversation.contactRole, contactName: selectedConversation.contactName }
        : null;

    if (!messageText.trim() || !target) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          receiverId: target.contactId,
          receiverRole: target.contactRole,
          receiverName: target.contactName,
          messageBody: messageText.trim(),
        }),
      });
      if (res.ok) {
        setMessageText('');
        if (showCompose) { setShowCompose(false); setNewRecipient(null); }
        // After sending, reload the full thread so the new message appears
        if (selectedConversation) await fetchThread(selectedConversation);
        await fetchMessages();
      } else {
        const err = await res.json().catch(() => ({}));
        setMsgMsg({type:'error',text:err.error || 'Failed to send message'});
      }
    } catch { setMsgMsg({type:'error',text:'Error sending message'}); }
    finally { setLoading(false); }
  };

  // --- Render -----------------------------------------------------------------

  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>

      {/* Auth error */}
      {authError && (
        <div style={{ padding: 16, background: 'rgba(239,68,68,0.2)', borderBottom: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}><FaExclamationTriangle style={{marginRight:4}} /></span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fca5a5', fontWeight: 600, margin: 0, fontSize: 14 }}>Session Expired or Missing</p>
            <p style={{ color: '#f87171', margin: 0, fontSize: 12, marginTop: 2 }}>Please sign out and log back in.</p>
          </div>
          <button onClick={() => { localStorage.clear(); window.location.href = '/auth/login'; }}
            style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Log Out
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', margin: 0 }}><FaComments style={{marginRight:4}} /> Messages</h2>
          <button
            onClick={() => { setShowCompose(true); setSelectedConversation(null); setComposeRoleFilter(activeTab); fetchAvailableContacts(); }}
            style={{ padding: '6px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + New
          </button>
        </div>

        {/* Category dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#9aa3b2', fontSize: 12, fontWeight: 600 }}>Category</label>
          <select
            value={activeTab}
            onChange={(e) => {
              const next = e.target.value as TabKey;
              setActiveTab(next);
              setSelectedConversation(null);
            }}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb', fontSize: 12, fontWeight: 600 }}>
            {ROLE_FILTERS.map((filter) => {
              const count = unreadByTab[filter.key] || 0;
              return (
                <option key={filter.key} value={filter.key}>
                  {filter.label}{count > 0 ? ` (${count > 99 ? '99+' : count} unread)` : ''}
                </option>
              );
            })}
          </select>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {filteredConversations.length} thread{filteredConversations.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: 420 }}>

        {/* Conversation list */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}><FaComments style={{marginRight:4}} /></div>
              No conversations yet.
              <br />
              <span style={{ color: '#4b5563' }}>Click <strong style={{ color: '#10b981' }}>+ New</strong> to start one.</span>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const icon = ROLE_ICON[conv.contactRole] ?? <FaUser />;
              const color = ROLE_COLOR[conv.contactRole] ?? '#9ca3af';
              const isActive = selectedConversation?.contactId === conv.contactId && selectedConversation?.contactRole === conv.contactRole;
              return (
                <div key={`${conv.contactRole}_${conv.contactId}`} onClick={() => handleSelectConversation(conv)}
                  style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                        {conv.contactName}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{ background: '#e5332a', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color, fontWeight: 600, display: 'block', marginBottom: 2 }}>
                      {ROLE_LABEL[conv.contactRole] ?? conv.contactRole}
                    </span>
                    <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.lastMessage.length > 40 ? conv.lastMessage.slice(0, 40) + '...' : conv.lastMessage}
                    </div>
                    <div style={{ fontSize: 9, color: '#4b5563', marginTop: 2 }}>
                      {new Date(conv.lastMessageAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Thread / Compose */}
        <div style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
          {showCompose ? (
            /* Compose */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: '#9aa3b2', fontSize: 12, marginBottom: 6 }}>Recipient type:</label>
                <select
                  value={composeRoleFilter}
                  onChange={(e) => {
                    setComposeRoleFilter(e.target.value as TabKey);
                    setNewRecipient(null);
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13, marginBottom: 10 }}>
                  {ROLE_FILTERS.map((filter) => (
                    <option key={`compose-${filter.key}`} value={filter.key}>{filter.label}</option>
                  ))}
                </select>

                <label style={{ display: 'block', color: '#9aa3b2', fontSize: 12, marginBottom: 6 }}>To:</label>
                {contactsLoading ? (
                  <div style={{ color: '#6b7280', fontSize: 12 }}>Loading contacts...</div>
                ) : filteredAvailableContacts.length === 0 ? (
                  <div style={{ color: '#f59e0b', fontSize: 13, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 8 }}>
                    No contacts in this category yet.
                  </div>
                ) : (
                  <select
                    value={newRecipient ? `${newRecipient.role}_${newRecipient.id}` : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) { setNewRecipient(null); return; }
                      const idx = val.indexOf('_');
                      const role = val.slice(0, idx);
                      const id = val.slice(idx + 1);
                      setNewRecipient(filteredAvailableContacts.find((c) => c.id === id && c.role === role) ?? null);
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13 }}>
                    <option value=''> -  Select recipient  - </option>
                    {filteredAvailableContacts.map((c) => (
                      <option key={`${c.role}_${c.id}`} value={`${c.role}_${c.id}`}>
                        {ROLE_ICON[c.role]} {c.name} ({ROLE_LABEL[c.role] ?? c.role})  -  {c.contextLabel}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                placeholder='Type your message...'
                value={messageText}
                maxLength={5000}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendMessage(); }}
                style={{ flex: 1, padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13, resize: 'none', minHeight: 100 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSendMessage} disabled={loading || !messageText.trim() || !newRecipient}
                  style={{ flex: 1, padding: 10, background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: loading || !messageText.trim() || !newRecipient ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, opacity: loading || !messageText.trim() || !newRecipient ? 0.5 : 1 }}>
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
                <button onClick={() => { setShowCompose(false); setMessageText(''); setNewRecipient(null); setComposeRoleFilter(activeTab); }}
                  style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Cancel
                </button>
              </div>
            </div>

          ) : selectedConversation ? (
            /* Thread */
            <>
              {/* Thread header */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.15)' }}>
                <span style={{ fontSize: 18 }}>{ROLE_ICON[selectedConversation.contactRole] ?? <FaUser />}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e5e7eb' }}>{selectedConversation.contactName}</div>
                  <div style={{ fontSize: 11, color: ROLE_COLOR[selectedConversation.contactRole] ?? '#9ca3af', fontWeight: 600 }}>
                    {ROLE_LABEL[selectedConversation.contactRole] ?? selectedConversation.contactRole}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {threadMessages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 12, padding: 12 }}>Loading messages...</div>
                )}
                {threadMessages
                  .slice()
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((msg) => {
                    const isSent = msg.senderId === userId;
                    return (
                      <div key={msg.id} style={{ alignSelf: isSent ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                        <div style={{ background: isSent ? 'rgba(229,51,42,0.2)' : 'rgba(59,130,246,0.2)', border: `1px solid ${isSent ? 'rgba(229,51,42,0.4)' : 'rgba(59,130,246,0.4)'}`, borderRadius: 8, padding: 12 }}>
                          {!isSent && (
                            <div style={{ fontSize: 10, color: ROLE_COLOR[msg.senderRole] ?? '#9ca3af', fontWeight: 700, marginBottom: 4 }}>
                              {msg.senderName}
                            </div>
                          )}
                          <div style={{ fontSize: 13, color: '#e5e7eb' }}>{msg.body}</div>
                          <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'right', marginTop: 4 }}>
                            {new Date(msg.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {/* Scroll anchor  -  always at the bottom */}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 8 }}>
                <textarea
                  placeholder={`Reply to ${selectedConversation.contactName}...`}
                  value={messageText}
                  maxLength={5000}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13, resize: 'none', minHeight: 60 }}
                />
                <button onClick={handleSendMessage} disabled={loading || !messageText.trim()}
                  style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: loading || !messageText.trim() ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, opacity: loading || !messageText.trim() ? 0.5 : 1, alignSelf: 'flex-end' }}>
                  {loading ? '...' : 'Send'}
                </button>
              </div>
            </>

          ) : (
            /* Empty */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#6b7280', gap: 8, padding: 24 }}>
              <span style={{ fontSize: 36 }}><FaComments style={{marginRight:4}} /></span>
              <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                Select a conversation<br />or click <strong style={{ color: '#10b981' }}>+ New</strong> to compose.
              </div>
            </div>
          )}
        </div>
      </div>
      {msgMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:msgMsg.type==='success'?'#dcfce7':'#fde8e8',color:msgMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {msgMsg.text}
          <button aria-label="Dismiss" onClick={()=>setMsgMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </div>
  );
}

