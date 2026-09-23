'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaLink } from 'react-icons/fa';

interface PaymentLink {
  id: string;
  token: string;
  amount: number;
  description: string;
  status: string;
  customerId: string | null;
  workOrderId: string | null;
  expiresAt: string;
  createdAt: string;
}

export default function PaymentLinksPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchLinks();
  }, [user]);

  const fetchLinks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payment-links', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setLinks(Array.isArray(data) ? data : []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const createLink = async () => {
    if (!customerName.trim()) { setError('Customer is required'); return; }
    if (!description.trim()) { setError('Description required'); return; }
    if (!amount || parseFloat(amount) < 0.01) { setError('Amount must be at least $0.01'); return; }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payment-links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), description, customerName: customerName.trim(), workOrderId: workOrderId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create link');
      setCreatedLink(`${window.location.origin}${data.link}`);
      setShowCreate(false);
      setAmount('');
      setDescription('');
      setCustomerName('');
      setWorkOrderId('');
      fetchLinks();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const copyLink = (tok: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/customer/pay/${tok}`);
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <Link href="/shop/admin" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> {say("Admin")}</Link>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>{say("Payment Links")}</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>{say("Job invoices are created from the work order. A link made here can still be tied to that work order.")}</p>
            </div>
            <button onClick={() => { setShowCreate(true); setCreatedLink(null); }}
              style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
              {say("+ New Link")}{' '}</button>
          </div>

          {/* Just-Created Link */}
          {createdLink && (
            <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 8 }}><FaLink style={{marginRight:4}} /> {say("Payment Link Created")}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13, background: '#000000', padding: 10, borderRadius: 8, wordBreak: 'break-all' }}>
                  {say(createdLink)}
                </div>
                <button onClick={() => navigator.clipboard.writeText(createdLink)}
                  style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                  {say("Copy")}{' '}</button>
              </div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>{say("Send this link to your customer via email, SMS, or messaging.")}</div>
            </div>
          )}

          {/* Create Form */}
          {showCreate && (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155', marginBottom: 24 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{say("Create Payment Link")}</h2>
              {error && <div style={{ color: '#ef4444', marginBottom: 12, fontSize: 14 }}>{say(error)}</div>}
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>{say("Customer *")}</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={say("Customer name")}
                  style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>{say("Work order ID")}</label>
                <input value={workOrderId} onChange={e => setWorkOrderId(e.target.value)} placeholder={say("Paste the work order id so this link belongs to that job")}
                  style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>{say("Amount ($)")}</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01"
                    style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>{say("Description *")}</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder={say("e.g. Brake repair invoice")}
                    style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createLink} disabled={saving || !customerName.trim() || !description.trim() || !amount || parseFloat(amount) < 0.01}
                  style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: saving || !customerName.trim() || !description.trim() || !amount || parseFloat(amount) < 0.01 ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving || !customerName.trim() || !description.trim() || !amount || parseFloat(amount) < 0.01 ? 0.5 : 1 }}>
                  {saving ? say("Creating...") : say("Create Link")}
                </button>
                <button onClick={() => setShowCreate(false)}
                  style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
                  {say("Cancel")}{' '}</button>
              </div>
            </div>
          )}

          {/* Links List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>{say("Loading payment links...")}</div>
          ) : links.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
              <div style={{ color: '#6b7280' }}>{say("No payment links yet. Create one to send to a customer.")}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {links.map(link => (
                <div key={link.id} style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ color: '#e5e7eb', fontWeight: 600 }}>{say(link.description)}</div>
                    {link.workOrderId && <div style={{ color: '#93c5fd', fontSize: 12, marginTop: 4 }}>{say("Work order")}{' '}{say(link.workOrderId)}</div>}
                    <div style={{ color: '#22c55e', fontSize: 20, fontWeight: 700 }}>${link.amount.toFixed(2)}</div>
                    <div style={{ color: '#4b5563', fontSize: 12, marginTop: 4 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: link.status === 'paid' ? '#052e16' : link.status === 'pending' ? '#422006' : '#1e293b',
                        color: link.status === 'paid' ? '#22c55e' : link.status === 'pending' ? '#eab308' : '#6b7280',
                      }}>{say(link.status)}</span>
                      <span style={{ marginLeft: 8 }}>{say("Created")}{' '}{new Date(link.createdAt).toLocaleDateString()}</span>
                      <span style={{ marginLeft: 8 }}>{say("Expires")}{' '}{new Date(link.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {link.status === 'pending' && (
                    <button onClick={() => copyLink(link.token)}
                      style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {say("Copy Link")}{' '}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}



