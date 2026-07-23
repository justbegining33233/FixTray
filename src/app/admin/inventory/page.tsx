'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaBox, FaExclamationTriangle, FaArrowDown, FaArrowUp } from 'react-icons/fa';

interface InventoryItem {
  id: string;
  shopId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  reorderPoint: number;
  reorderQuantity: number;
  category: string;
  lastRestocked?: string;
}

interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  value30Days: number;
  averageQuantity: number;
}

export default function AdminInventoryPage() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shopFilter, setShopFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'quantity' | 'value' | 'reorder'>('quantity');

  useEffect(() => {
    if (!user) return;
    loadInventory();
  }, [user]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/inventory', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch inventory');
      const data = await res.json();
      
      setInventory(data.items || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const lowStockItems = inventory.filter(item => item.quantity <= item.reorderPoint);
  const outOfStockItems = inventory.filter(item => item.quantity === 0);

  const sortedInventory = [...inventory].sort((a, b) => {
    switch (sortBy) {
      case 'quantity':
        return a.quantity - b.quantity;
      case 'value':
        return (b.unitCost * b.quantity) - (a.unitCost * a.quantity);
      case 'reorder':
        return (a.quantity / a.reorderPoint) - (b.quantity / b.reorderPoint);
      default:
        return 0;
    }
  });

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
              <FaBox style={{ marginRight: 12, verticalAlign: 'middle' }} />
              Platform Inventory
            </h1>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>Monitor inventory across all shops</p>
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
                { label: 'Total Items', value: stats.totalItems, icon: <FaBox />, color: '#3b82f6' },
                { label: 'Low Stock', value: stats.lowStockItems, icon: <FaExclamationTriangle />, color: '#f59e0b' },
                { label: 'Out of Stock', value: stats.outOfStockItems, icon: <FaArrowDown />, color: '#e5332a' },
                { label: 'Total Value', value: `$${(stats.totalValue / 1000).toFixed(1)}K`, icon: <FaArrowUp />, color: '#ec4899' },
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

          {/* Critical Alerts */}
          {outOfStockItems.length > 0 && (
            <div style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fca5a5', marginBottom: 12 }}>
                🚨 {outOfStockItems.length} Items Out of Stock
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {outOfStockItems.slice(0, 5).map(item => (
                  <div key={item.id} style={{
                    background: 'rgba(229,51,42,0.25)',
                    color: '#fca5a5',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                  }}>
                    {item.itemName} (SKU: {item.sku})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Sort by</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#e5e7eb',
                  fontSize: 13,
                }}
              >
                <option value="quantity">Low to High Quantity</option>
                <option value="value">Highest Value</option>
                <option value="reorder">Closest to Reorder Point</option>
              </select>
            </div>
          </div>

          {/* Inventory Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              No inventory items found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Item Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>SKU</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Quantity</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Reorder Point</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Unit Cost</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Total Value</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInventory.slice(0, 50).map(item => {
                    const totalValue = item.unitCost * item.quantity;
                    let status = 'OK';
                    let statusColor = '#22c55e';
                    if (item.quantity === 0) {
                      status = 'OUT OF STOCK';
                      statusColor = '#e5332a';
                    } else if (item.quantity <= item.reorderPoint) {
                      status = 'LOW STOCK';
                      statusColor = '#f59e0b';
                    }
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px', color: '#e5e7eb', fontWeight: 500 }}>{item.itemName}</td>
                        <td style={{ padding: '16px', color: '#9ca3af', fontSize: 12 }}>{item.sku}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: '#e5e7eb', fontWeight: 600 }}>{item.quantity}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>{item.reorderPoint}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: '#e5e7eb' }}>${item.unitCost.toFixed(2)}</td>
                        <td style={{ padding: '16px', textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>${totalValue.toFixed(2)}</td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{
                            background: `${statusColor}20`,
                            color: statusColor,
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sortedInventory.length > 50 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>
                  Showing 50 of {sortedInventory.length} items
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
