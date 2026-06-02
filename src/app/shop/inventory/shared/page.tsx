'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';

interface SharedItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderPoint: number;
  price: number;
  shopId: string;
  shopName: string;
}

export default function SharedInventoryPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [transferModal, setTransferModal] = useState<SharedItem | null>(null);
  const [targetShopId, setTargetShopId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [transferring, setTransferring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchShared();
  }, [user, lowStockOnly]);

  const fetchShared = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = lowStockOnly ? '?lowStockOnly=true' : '';
      const res = await fetch(`/api/inventory/shared${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const handleTransfer = async () => {
    if (!transferModal || !targetShopId || !transferQty) return;
    setTransferring(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/inventory/shared', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: transferModal.id,
          fromShopId: transferModal.shopId,
          toShopId: targetShopId,
          quantity: parseInt(transferQty),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');
      setToast(`Transferred ${transferQty}  ${transferModal.name}`);
      setTimeout(() => setToast(null), 3000);
      setTransferModal(null);
      fetchShared();
    } catch (e: any) {
      alert(e.message);
    } finally { setTransferring(false); }
  };

  // Get unique shop names for the transfer target dropdown
  const shopOptions = [...new Map(items.map(i => [i.shopId, { id: i.shopId, name: i.shopName }])).values()];

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Link href="/shop/inventory" style={{ color: '#ff6b64', textDecoration: 'none', fontSize: 14 }}><FaArrowLeft style={{marginRight:4}} /> Inventory</Link>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 4 }}>Shared Inventory</h1>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>View inventory across all your shops and transfer parts</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#e5332a' }} />
              <span style={{ color: '#e5e7eb', fontSize: 14 }}>Low Stock Only</span>
            </label>
          </div>

          {toast && (
            <div style={{ position: 'fixed', top: 80, right: 24, background: '#052e16', color: '#22c55e', padding: '12px 20px', borderRadius: 8, border: '1px solid #16a34a', zIndex: 50, fontSize: 14 }}>
              <FaCheckCircle style={{marginRight:4}} /> {toast}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading shared inventory...</div>
          ) : items.length === 0 ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #334155' }}>
              <div style={{ color: '#6b7280' }}>{lowStockOnly ? 'No low-stock items across your shops' : 'No shared inventory found. You may need multiple shop locations.'}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>Part</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>SKU</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>Shop</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>Qty</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>Reorder</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>Price</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 16px', color: '#e5e7eb', fontSize: 14 }}>{item.name}</td>
                      <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}>{item.sku}</td>
                      <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: 13 }}>{item.shopName}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                          background: item.quantity <= item.reorderPoint ? '#450a0a' : item.quantity <= item.reorderPoint * 2 ? '#422006' : '#000000',
                          color: item.quantity <= item.reorderPoint ? '#ef4444' : item.quantity <= item.reorderPoint * 2 ? '#eab308' : '#e5e7eb',
                        }}>{item.quantity}</span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 13, textAlign: 'center' }}>{item.reorderPoint}</td>
                      <td style={{ padding: '10px 16px', color: '#e5e7eb', fontSize: 14, textAlign: 'right' }}>${item.price.toFixed(2)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => { setTransferModal(item); setTargetShopId(''); setTransferQty('1'); }}
                          style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Transfer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transfer Modal */}
          {transferModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
              <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, maxWidth: 420, width: '100%', border: '1px solid #334155' }}>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Transfer: {transferModal.name}</h3>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>From</label>
                  <div style={{ color: '#e5e7eb', fontSize: 14, background: '#000000', padding: '10px 12px', borderRadius: 8 }}>
                    {transferModal.shopName} (Qty: {transferModal.quantity})
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>To Shop</label>
                  <select value={targetShopId} onChange={e => setTargetShopId(e.target.value)}
                    style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}>
                    <option value="">Select target shop</option>
                    {shopOptions.filter(s => s.id !== transferModal.shopId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>Quantity</label>
                  <input type="number" min="1" max={transferModal.quantity} value={transferQty}
                    onChange={e => setTransferQty(e.target.value)}
                    style={{ width: '100%', background: '#000000', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleTransfer} disabled={transferring || !targetShopId}
                    style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 600, opacity: transferring || !targetShopId ? 0.5 : 1 }}>
                    {transferring ? 'Transferring...' : 'Transfer'}
                  </button>
                  <button onClick={() => setTransferModal(null)}
                    style={{ flex: 1, background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}



