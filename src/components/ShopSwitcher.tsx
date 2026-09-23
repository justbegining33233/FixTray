'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCaretDown, FaCheck, FaStore } from 'react-icons/fa';

interface Shop {
  id: string;
  businessName: string;
  email: string;
}

export default function ShopSwitcher() {
  const say = usePhrase();
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShopId, setCurrentShopId] = useState('');
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('shopId') || '';
    setCurrentShopId(id);
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/switch', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops || []);
      }
    } catch {}
  };

  const switchTo = async (shopId: string) => {
    if (shopId === currentShopId) { setOpen(false); return; }
    setSwitching(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/shop/switch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        localStorage.setItem('shopId', shopId);
        localStorage.setItem('shopName', data.shopName || '');
        setCurrentShopId(shopId);
        setOpen(false);
        router.refresh();
        window.location.reload();
      }
    } catch {}
    finally { setSwitching(false); }
  };

  // Don't render if only 1 shop
  if (shops.length <= 1) return null;

  const current = shops.find(s => s.id === currentShopId);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155',
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#e5e7eb', fontSize: 13,
        }}
      >
        <span><FaStore style={{marginRight:4}} /></span>
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.businessName || say("Switch Shop")}
        </span>
        <span style={{ color: '#6b7280', fontSize: 10 }}><FaCaretDown style={{marginRight:4}} /></span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#1e293b',
          border: '1px solid #334155', borderRadius: 10, minWidth: 220, zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155', color: '#9ca3af', fontSize: 11, fontWeight: 600 }}>
            {say("YOUR SHOPS")}{' '}</div>
          {shops.map(shop => (
            <button
              key={shop.id}
              onClick={() => switchTo(shop.id)}
              disabled={switching}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', cursor: 'pointer',
                background: shop.id === currentShopId ? '#0f172a' : 'transparent',
                color: '#e5e7eb', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '1px solid #1e293b',
              }}
            >
              {shop.id === currentShopId && <span style={{ color: '#22c55e' }}><FaCheck style={{marginRight:4}} /></span>}
              <div>
                <div style={{ fontWeight: shop.id === currentShopId ? 600 : 400 }}>{say(shop.businessName)}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>{say(shop.email)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
