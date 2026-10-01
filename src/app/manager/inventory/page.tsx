'use client';

import { usePhrase } from '@/lib/usePhrase';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBox, FaExclamationTriangle, FaPlus, FaSearch, FaEdit, FaTrash } from 'react-icons/fa';
import { decodeToken } from '@/lib/auth-client';
import { shopIdForStaffInventory } from '@/lib/shopAccess';
import {
  formatInventoryType,
  inventoryRowsFromPayload,
  isShopInventoryLowStock,
  normalizeInventoryType,
  ShopInventoryRow,
} from '@/lib/inventoryItem';

const emptyForm = {
  type: '',
  name: '',
  sku: '',
  quantity: '0',
  price: '0',
  reorderPoint: '',
  supplier: '',
  notes: '',
};

export default function ManagerInventory() {
  const say = usePhrase();
  const { user } = useRequireAuth(['manager']);
  const [hasInventoryAccess] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShopInventoryRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopInventoryRow | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saveError, setSaveError] = useState('');

  const currentShopId = useCallback(() => {
    const token = localStorage.getItem('token');
    const decoded = token ? decodeToken(token) : null;
    return shopIdForStaffInventory({
      role: decoded?.role || user?.role,
      tokenShopId: decoded?.shopId,
      storedShopId: user?.shopId || localStorage.getItem('shopId'),
    });
  }, [user?.role, user?.shopId]);

  const fetchInventory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const shopId = currentShopId();
      if (!token || !shopId) return;
      // Shop owners keep stock on /api/inventory. That is the shop's item list.
      const url = `/api/inventory?shopId=${encodeURIComponent(shopId)}${showLowStock ? '&lowStockOnly=true' : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setItems(inventoryRowsFromPayload(data));
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [showLowStock, currentShopId]);

  useEffect(() => {
    if (hasInventoryAccess) fetchInventory();
  }, [hasInventoryAccess, fetchInventory]);

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    const shopId = currentShopId();
    if (!token || !shopId) return;
    setSaveError('');

    const type = normalizeInventoryType(formData.type);
    if (!type || !formData.name.trim()) {
      setSaveError(say('Name and type are required'));
      return;
    }

    const payload: Record<string, unknown> = {
      type,
      name: formData.name.trim(),
      quantity: Number.parseInt(formData.quantity, 10) || 0,
      price: Number.parseFloat(formData.price) || 0,
      supplier: formData.supplier,
      notes: formData.notes,
    };
    if (!editingItem) payload.shopId = shopId;
    if (formData.sku.trim()) payload.sku = formData.sku.trim();
    if (formData.reorderPoint !== '') payload.reorderPoint = Number.parseInt(formData.reorderPoint, 10) || 0;

    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/inventory/${editingItem.id}` : '/api/inventory';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddForm(false);
        setEditingItem(null);
        setFormData(emptyForm);
        fetchInventory();
      } else {
        const error = await res.json().catch(() => ({}));
        setSaveError(error.error || say('Failed to save item'));
      }
    } catch (err) {
      console.error('Error saving item:', err);
      setSaveError(say('Failed to save item'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(say('Delete this inventory item?'))) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchInventory();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const startEdit = (item: ShopInventoryRow) => {
    setEditingItem(item);
    setFormData({
      type: normalizeInventoryType(item.type) || item.type || '',
      name: item.name,
      sku: item.sku || '',
      quantity: String(item.quantity ?? 0),
      price: String(item.price ?? 0),
      reorderPoint: item.reorderPoint != null ? String(item.reorderPoint) : '',
      supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setSaveError('');
    setShowAddForm(true);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = normalizedSearch
    ? items.filter((item) => {
        const searchable = [item.name, item.type, item.sku, item.supplier, item.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(normalizedSearch);
      })
    : items;

  const lowStockCount = items.filter(isShopInventoryLowStock).length;
  const totalValue = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>{say("Loading...")}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/manager/home" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaBox style={{marginRight:4}} /> {say("Inventory Management")}</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>{say("Track parts, supplies, and equipment")}</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        {hasInventoryAccess ? (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <FaSearch style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280', fontSize: 14 }} />
                <input
                  type="text" placeholder={say("Search parts...")}
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 14 }}
                />
              </div>
              <button onClick={() => setShowLowStock(!showLowStock)}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.4)', background: showLowStock ? 'rgba(245,158,11,0.2)' : 'transparent', color: showLowStock ? '#f59e0b' : '#9aa3b2', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <FaExclamationTriangle style={{ marginRight: 4 }} /> {say("Low Stock")}{' '}</button>
              <button onClick={() => { setEditingItem(null); setFormData(emptyForm); setSaveError(''); setShowAddForm(true); }}
                style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <FaPlus style={{ marginRight: 4 }} /> {say("Add Item")}{' '}</button>
            </div>

            {showAddForm && (
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>{editingItem ? say("Edit Item") : say("Add New Item")}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#9aa3b2', marginBottom: 4 }}>{say("Name")}</label>
                    <input type="text" value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#9aa3b2', marginBottom: 4 }}>{say("Type")}</label>
                    <select value={normalizeInventoryType(formData.type) || formData.type}
                      onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13 }}
                    >
                      <option value="">{say("Select type")}</option>
                      <option value="part">{say("Part")}</option>
                      <option value="labor">{say("Labor")}</option>
                      {formData.type && !normalizeInventoryType(formData.type) && (
                        <option value={formData.type}>{say(formData.type)}</option>
                      )}
                    </select>
                  </div>
                  {[
                    { label: say("SKU"), key: 'sku', type: 'text' },
                    { label: say("Supplier"), key: 'supplier', type: 'text' },
                    { label: say("Quantity"), key: 'quantity', type: 'number' },
                    { label: say("Reorder Point"), key: 'reorderPoint', type: 'number' },
                    { label: say("Price"), key: 'price', type: 'number' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: 11, color: '#9aa3b2', marginBottom: 4 }}>{say(f.label)}</label>
                      <input type={f.type} value={(formData as Record<string, string>)[f.key]}
                        onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#9aa3b2', marginBottom: 4 }}>{say("Notes")}</label>
                  <textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 13, minHeight: 60, resize: 'vertical' }}
                  />
                </div>
                {saveError && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 12 }}>{saveError}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={handleSave} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                    {editingItem ? say("Update") : say("Add Item")}
                  </button>
                  <button onClick={() => { setShowAddForm(false); setEditingItem(null); setSaveError(''); }} style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                    {say("Cancel")}{' '}</button>
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {[say("Name"), say("SKU"), say("Type"), say("Qty"), say("Reorder"), say("Price"), say("Supplier"), say("Actions")].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9aa3b2', textTransform: 'uppercase' }}>{say(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                        {items.length === 0 ? say("No inventory items yet. Click \"Add Item\" to get started.") : say("No items match your search.")}
                      </td></tr>
                    ) : filteredItems.map(item => {
                      const lowStock = isShopInventoryLowStock(item);
                      return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>{say(item.name)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>{item.sku || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>{formatInventoryType(item.type) || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: lowStock ? '#ef4444' : '#22c55e' }}>{say(item.quantity ?? 0)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>{item.reorderPoint ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>${(item.price || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#9aa3b2' }}>{item.supplier || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', color: '#e5332a', cursor: 'pointer', fontSize: 14 }}><FaEdit /></button>
                            <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}><FaTrash /></button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
              {[
                { label: say("Total Items"), value: items.length, color: '#e5332a' },
                { label: say("Low Stock"), value: lowStockCount, color: '#ef4444' },
                { label: say("Total Value"), value: `$${totalValue.toFixed(2)}`, color: '#10b981' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{say(stat.value)}</div>
                  <div style={{ fontSize: 12, color: '#9aa3b2', marginTop: 4 }}>{say(stat.label)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>
              <FaExclamationTriangle style={{ fontSize: 48, marginBottom: 16, color: '#f59e0b' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>{say("Inventory Management")}</h3>
              <p>{say("Advanced inventory tracking is currently unavailable for this account context.")}</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>{say("Track parts, manage stock levels, and automate reordering.")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
