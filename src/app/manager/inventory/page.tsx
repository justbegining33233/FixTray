'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBox, FaExclamationTriangle, FaPlus, FaSearch, FaEdit, FaTrash } from 'react-icons/fa';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  description: string;
  quantity: number;
  reorderPoint: number;
  unitCost: number;
  sellingPrice: number;
  category: string;
  location: string;
}

export default function ManagerInventory() {
  const { user } = useRequireAuth(['manager']);
  const [hasInventoryAccess] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({ name: '', sku: '', description: '', quantity: 0, reorderPoint: 5, unitCost: 0, sellingPrice: 0, category: '', location: '' });

  useEffect(() => {
    if (!user) return;
    setLoading(false);
  }, [user]);

  const fetchInventory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const shopId = localStorage.getItem('shopId');
      if (!token || !shopId) return;
      const url = `/api/shop/inventory-stock?shopId=${encodeURIComponent(shopId)}${showLowStock ? '&lowStockOnly=true' : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? data ?? []);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  }, [showLowStock]);

  useEffect(() => {
    if (hasInventoryAccess) fetchInventory();
  }, [hasInventoryAccess, fetchInventory]);

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    const shopId = localStorage.getItem('shopId');
    if (!token || !shopId) return;

    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/shop/inventory-stock?id=${editingItem.id}` : '/api/shop/inventory-stock';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, shopId }),
      });
      if (res.ok) {
        setShowAddForm(false);
        setEditingItem(null);
        setFormData({ name: '', sku: '', description: '', quantity: 0, reorderPoint: 5, unitCost: 0, sellingPrice: 0, category: '', location: '' });
        fetchInventory();
      }
    } catch (err) {
      console.error('Error saving item:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this inventory item?')) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/shop/inventory-stock?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchInventory();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({ name: item.name, sku: item.sku || '', description: item.description || '', quantity: item.quantity, reorderPoint: item.reorderPoint, unitCost: item.unitCost, sellingPrice: item.sellingPrice, category: item.category || '', location: item.location || '' });
    setShowAddForm(true);
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/manager/dashboard" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaBox style={{marginRight:4}} /> Inventory Management</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>Track parts, supplies, and equipment</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        {hasInventoryAccess ? (
          <>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <FaSearch style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280', fontSize: 14 }} />
                <input
                  type="text" placeholder="Search parts..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 14 }}
                />
              </div>
              <button onClick={() => setShowLowStock(!showLowStock)}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.4)', background: showLowStock ? 'rgba(245,158,11,0.2)' : 'transparent', color: showLowStock ? '#f59e0b' : '#9aa3b2', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <FaExclamationTriangle style={{ marginRight: 4 }} /> Low Stock
              </button>
              <button onClick={() => { setEditingItem(null); setFormData({ name: '', sku: '', description: '', quantity: 0, reorderPoint: 5, unitCost: 0, sellingPrice: 0, category: '', location: '' }); setShowAddForm(true); }}
                style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <FaPlus style={{ marginRight: 4 }} /> Add Item
              </button>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Name', key: 'name', type: 'text' },
                    { label: 'SKU', key: 'sku', type: 'text' },
                    { label: 'Category', key: 'category', type: 'text' },
                    { label: 'Location', key: 'location', type: 'text' },
                    { label: 'Quantity', key: 'quantity', type: 'number' },
                    { label: 'Reorder Point', key: 'reorderPoint', type: 'number' },
                    { label: 'Unit Cost ($)', key: 'unitCost', type: 'number' },
                    { label: 'Selling Price ($)', key: 'sellingPrice', type: 'number' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: 11, color: '#9aa3b2', marginBottom: 4 }}>{f.label}</label>
                      <input type={f.type} value={(formData as any)[f.key]}
                        onChange={e => setFormData(prev => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#9aa3b2', marginBottom: 4 }}>Description</label>
                  <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13, minHeight: 60, resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={handleSave} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                    {editingItem ? 'Update' : 'Add Item'}
                  </button>
                  <button onClick={() => { setShowAddForm(false); setEditingItem(null); }} style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Inventory Table */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Name', 'SKU', 'Category', 'Qty', 'Reorder', 'Cost', 'Price', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9aa3b2', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                        {items.length === 0 ? 'No inventory items yet. Click "Add Item" to get started.' : 'No items match your search.'}
                      </td></tr>
                    ) : filteredItems.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>{item.sku || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>{item.category || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: item.quantity <= item.reorderPoint ? '#ef4444' : '#22c55e' }}>{item.quantity}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>{item.reorderPoint}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>${item.unitCost?.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>${item.sellingPrice?.toFixed(2)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', color: '#e5332a', cursor: 'pointer', fontSize: 14 }}><FaEdit /></button>
                            <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}><FaTrash /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
              {[
                { label: 'Total Items', value: items.length, color: '#e5332a' },
                { label: 'Low Stock', value: items.filter(i => i.quantity <= i.reorderPoint).length, color: '#ef4444' },
                { label: 'Total Value', value: `$${items.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0).toFixed(2)}`, color: '#10b981' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: '#9aa3b2', marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>
              <FaExclamationTriangle style={{ fontSize: 48, marginBottom: 16, color: '#f59e0b' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>Inventory Management</h3>
              <p>Advanced inventory tracking is currently unavailable for this account context.</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>Track parts, manage stock levels, and automate reordering.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}