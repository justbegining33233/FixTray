'use client';

import { useEffect, useState } from 'react';
import { FaEnvelope, FaMobileAlt, FaRocket, FaBullhorn } from 'react-icons/fa';
import { useRequireAuth } from '@/contexts/AuthContext';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';

interface Campaign {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
}

export default function CampaignsPage() {
  useRequireAuth(['shop', 'manager']);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'email' | 'sms' | 'both'>('email');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/campaigns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCampaigns(await res.json());
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (sendNow: boolean) => {
    if (!name || !messageBody) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/campaigns', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, subject, messageBody, sendNow }),
      });
      if (res.ok) {
        setShowCreate(false);
        setName('');
        setSubject('');
        setMessageBody('');
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendExisting = async (campaignId: string) => {
    setSendingCampaignId(campaignId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/campaigns', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, sendNow: true }),
      });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to send campaign:', err);
    } finally {
      setSendingCampaignId(null);
    }
  };

  const cardStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 20,
  };

  const statusColors: Record<string, string> = {
    draft: '#f59e0b',
    sending: '#e5332a',
    sent: '#22c55e',
    failed: '#e5332a',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb' }}>Campaigns</h1>
            <p style={{ fontSize: 14, color: '#9aa3b2' }}>Send bulk SMS and email to your customers</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{ padding: '10px 20px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            + New Campaign
          </button>
        </div>

        {/* Create Campaign Form */}
        {showCreate && (
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>New Campaign</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#9aa3b2', display: 'block', marginBottom: 4 }}>Campaign Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Spring Special Offer"
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e5e7eb', fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#9aa3b2', display: 'block', marginBottom: 4 }}>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['email', 'sms', 'both'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      padding: '8px 16px',
                      background: type === t ? '#e5332a' : 'rgba(255,255,255,0.05)',
                      color: type === t ? 'white' : '#9aa3b2',
                      border: `1px solid ${type === t ? '#e5332a' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t === 'both' ? <><FaEnvelope style={{marginRight:2}} />+<FaMobileAlt style={{marginLeft:2, marginRight:2}} /> Both</> : t === 'email' ? <><FaEnvelope style={{marginRight:6}} />Email</> : <><FaMobileAlt style={{marginRight:6}} />SMS</>}
                  </button>
                ))}
              </div>
            </div>

            {(type === 'email' || type === 'both') && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#9aa3b2', display: 'block', marginBottom: 4 }}>Email Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Special Spring Offer Just for You!"
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e5e7eb', fontSize: 14 }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#9aa3b2', display: 'block', marginBottom: 4 }}>Message</label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={5}
                placeholder={type === 'sms' ? 'Keep it under 160 characters for SMS...' : 'Your message to customers. HTML is supported for email.'}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e5e7eb', fontSize: 14, resize: 'vertical' }}
              />
              {type === 'sms' && (
                <div style={{ fontSize: 12, color: messageBody.length > 160 ? '#e5332a' : '#9aa3b2', marginTop: 4 }}>
                  {messageBody.length}/160 characters
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => handleSend(true)}
                disabled={sending || !name || !messageBody}
                style={{ padding: '10px 20px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: sending ? 0.6 : 1 }}
              >
                {sending ? 'Sending...' : <><FaRocket style={{marginRight:6}} />Send Now</>}
              </button>
              <button
                onClick={() => handleSend(false)}
                disabled={sending || !name || !messageBody}
                style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Save as Draft
              </button>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: '10px 20px', background: 'transparent', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Campaign History */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9aa3b2' }}>Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}><FaBullhorn /></div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>No campaigns yet</div>
            <div style={{ fontSize: 14, color: '#9aa3b2' }}>Create your first campaign to reach your customers</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map(c => (
              <div key={c.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb' }}>{c.name}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: statusColors[c.status], background: `${statusColors[c.status]}20`, textTransform: 'capitalize' }}>
                        {c.status}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, color: '#9aa3b2', background: 'rgba(255,255,255,0.05)', textTransform: 'uppercase' }}>
                        {c.type}
                      </span>
                    </div>
                    {c.subject && <div style={{ fontSize: 13, color: '#9aa3b2' }}>Subject: {c.subject}</div>}
                    <div style={{ fontSize: 13, color: '#9aa3b2', marginTop: 4 }}>
                      {c.recipientCount} recipients
                      {c.status === 'sent' && ` - ${c.sentCount} sent - ${c.failedCount} failed`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#9aa3b2' }}>
                      {c.sentAt ? new Date(c.sentAt).toLocaleDateString() : new Date(c.createdAt).toLocaleDateString()}
                    </div>
                    {(c.status === 'draft' || c.status === 'failed') && (
                      <button
                        onClick={() => handleSendExisting(c.id)}
                        disabled={sendingCampaignId === c.id}
                        style={{
                          padding: '6px 10px',
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: sendingCampaignId === c.id ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: sendingCampaignId === c.id ? 0.7 : 1,
                        }}
                      >
                        {sendingCampaignId === c.id ? 'Sending...' : 'Send'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

