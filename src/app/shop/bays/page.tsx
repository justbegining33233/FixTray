'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaBuilding, FaCheckCircle, FaTrash } from 'react-icons/fa';

interface Bay {
  id: string;
  name: string;
  type: string;
  status: 'empty' | 'occupied' | 'reserved';
  workOrderId?: string;
  techId?: string;
  vehicleDesc?: string;
  notes?: string;
  startedAt?: string;
}

const BAY_TYPES = ['general', 'alignment', 'tire', 'lube', 'inspection', 'detail'];
const statusColors: Record<string, string> = {
  empty: '#22c55e',
  occupied: '#e5332a',
  reserved: '#f59e0b',
};
const statusBg: Record<string, string> = {
  empty: 'rgba(34,197,94,0.12)',
  occupied: 'rgba(229,51,42,0.12)',
  reserved: 'rgba(245,158,11,0.12)',
};

export default function BaysPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['shop']);
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newBay, setNewBay] = useState({ name: '', type: 'general' });
  const [editBay, setEditBay] = useState<Bay | null>(null);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [bayError, setBayError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchBays();
  }, [user]);

  const fetchBays = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/bays', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setBays(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const addBay = async () => {
    if (!newBay.name.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/bays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newBay),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setBayError(d.error || 'Failed to add bay.'); }
      else { setNewBay({ name: '', type: 'general' }); setShowAdd(false); fetchBays(); }
    } catch (err: any) { setBayError(err?.message || 'Network error.'); }
    setSaving(false);
  };

  const updateStatus = async (bayId: string, status: string, extra: Partial<Bay> = {}) => {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/bays/${bayId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setBayError(d.error || 'Failed to update bay status.'); }
      else fetchBays();
    } catch (err: any) { setBayError(err?.message || 'Network error.'); }
  };

  const deleteBay = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/bays/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setBayError(d.error || 'Failed to delete bay.'); }
      else fetchBays();
    } catch (err: any) { setBayError(err?.message || 'Network error.'); }
    setDeleteConfirmId(null);
  };

  const saveEdit = async () => {
    if (!editBay) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/bays/${editBay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editBay),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setBayError(d.error || 'Failed to save bay.'); }
      else { setEditBay(null); fetchBays(); }
    } catch (err: any) { setBayError(err?.message || 'Network error.'); }
    setSaving(false);
  };

  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>
  );
  if (!user) return null;

  const stats = {
    total: bays.length,
    occupied: bays.filter(b => b.status === 'occupied').length,
    reserved: bays.filter(b => b.status === 'reserved').length,
    empty: bays.filter(b => b.status === 'empty').length,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaBuilding style={{marginRight:4}} /> {say("Bay & Lift Board")}</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>{say("Real-time view of all bays and lifts")}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: say("Total"), value: stats.total, color: '#6b7280' },
            { label: say("In Use"), value: stats.occupied, color: '#e5332a' },
            { label: say("Reserved"), value: stats.reserved, color: '#f59e0b' },
            { label: say("Open"), value: stats.empty, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{say(s.value)}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{say(s.label)}</div>
            </div>
          ))}
          <button onClick={() => setShowAdd(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{say("+ Add Bay")}</button>
        </div>
      </div>

      {/* Bay Grid */}
      <div style={{ padding: 32 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 64, fontSize: 18 }}>{say("Loading bays...")}</div>
        ) : bays.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 64 }}><FaBuilding style={{marginRight:4}} /></div>
            <div style={{ fontSize: 20, fontWeight: 600, margin: '16px 0 8px' }}>{say("No bays configured")}</div>
            <div style={{ color: '#9ca3af', marginBottom: 24 }}>{say("Add your bays and lifts to start tracking vehicle locations")}</div>
            <button onClick={() => setShowAdd(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{say("+ Add First Bay")}</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {bays.map(bay => (
              <div key={bay.id}
                draggable
                onDragStart={() => setDrag(bay.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (drag && drag !== bay.id) {
                    // Swap order: update dragged bay to reserve and drop target to occupied visually via re-fetch
                    setDrag(null);
                    fetchBays();
                  }
                }}
                style={{
                  background: statusBg[bay.status],
                  border: `2px solid ${statusColors[bay.status]}`,
                  borderRadius: 14,
                  padding: 20,
                  cursor: 'grab',
                  transition: 'transform 0.2s',
                  opacity: drag === bay.id ? 0.5 : 1,
                }}>
                {/* Bay Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{say(bay.name)}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>{say(bay.type)}</div>
                  </div>
                  <span style={{ background: statusColors[bay.status], color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                    {say(bay.status)}
                  </span>
                </div>

                {/* Content */}
                {bay.status === 'empty' ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af', fontSize: 14 }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}><FaCheckCircle style={{marginRight:4}} /></div>
                    {say("Available")}{' '}</div>
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                    {bay.vehicleDesc && <div><span style={{ color: '#9ca3af' }}>{say("Vehicle:")}{' '}</span>{say(bay.vehicleDesc)}</div>}
                    {bay.workOrderId && <div><span style={{ color: '#9ca3af' }}>{say("WO:")}{' '}</span><span style={{ color: '#60a5fa' }}>#{bay.workOrderId.slice(-6).toUpperCase()}</span></div>}
                    {bay.startedAt && <div><span style={{ color: '#9ca3af' }}>{say("Started:")}{' '}</span>{new Date(bay.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                    {bay.notes && <div style={{ marginTop: 6, color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>{say(bay.notes)}</div>}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {bay.status !== 'occupied' && (
                    <button onClick={() => setEditBay(bay)}
                      style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {say("Assign Vehicle")}{' '}</button>
                  )}
                  {bay.status !== 'empty' && (
                    <button onClick={() => updateStatus(bay.id, 'empty', { workOrderId: undefined, techId: undefined, vehicleDesc: undefined })}
                      style={{ flex: 1, background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid #22c55e', borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {say("Clear Bay")}{' '}</button>
                  )}
                  {bay.status === 'empty' && (
                    <button onClick={() => updateStatus(bay.id, 'reserved')}
                      style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {say("Reserve")}{' '}</button>
                  )}
                  <button onClick={() => setDeleteConfirmId(bay.id)}
                    style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                    <FaTrash style={{marginRight:4}} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Bay Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 380, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>{say("Add Bay / Lift")}</h3>
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{say("Bay Name")}</label>
            <input value={newBay.name} onChange={e => setNewBay(p => ({ ...p, name: e.target.value }))}
              placeholder={say("e.g. Bay 1, Alignment Lift, Tire Bay")}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{say("Type")}</label>
            <select value={newBay.type} onChange={e => setNewBay(p => ({ ...p, type: e.target.value }))}
              style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 20 }}>
              {BAY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addBay} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? say("Adding...") : say("Add Bay")}
              </button>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>
                {say("Cancel")}{' '}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Vehicle Modal */}
      {editBay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 420, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>{say("Assign to")}{' '}{say(editBay.name)}</h3>
            {(["vehicleDesc", "workOrderId", "techId", 'notes'] as const).map(field => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                  {field === "vehicleDesc" ? say("Vehicle (Year/Make/Model)") : field === "workOrderId" ? say("Work Order ID (optional)") : field === "techId" ? say("Tech Name/ID (optional)") : say("Notes")}
                </label>
                <input
                  value={(editBay as any)[field] || ''}
                  onChange={e => setEditBay(p => p ? { ...p, [field]: e.target.value } : p)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>{say("Status")}</label>
              <select value={editBay.status} onChange={e => setEditBay(p => p ? { ...p, status: e.target.value as Bay['status'] } : p)}
                style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14 }}>
                <option value="occupied">{say("Occupied")}</option>
                <option value="reserved">{say("Reserved")}</option>
                <option value="empty">{say("Empty")}</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? say("Saving...") : say("Save")}
              </button>
              <button onClick={() => setEditBay(null)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>
                {say("Cancel")}{' '}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{say("Remove Bay?")}</h3>
            <p style={{ color: '#9ca3af', marginBottom: 24 }}>{say("This bay will be permanently removed.")}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => deleteBay(deleteConfirmId)} style={{ background: '#e5332a', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>{say("Remove")}</button>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background: '#374151', border: 'none', color: '#9ca3af', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>{say("Cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {bayError && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#ef4444', color: '#fff', padding: '12px 20px', borderRadius: 8, zIndex: 300, fontWeight: 600, cursor: 'pointer' }}
          onClick={() => setBayError('')}
        >{say(bayError)}</div>
      )}
    </div>
  );
}
