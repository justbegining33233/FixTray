'use client';

import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaArrowDown, FaArrowUp, FaCar, FaExclamationTriangle, FaTrash } from 'react-icons/fa';

interface Loaner {
  id: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  licensePlate?: string;
  vin?: string;
  status: 'available' | 'out' | 'maintenance';
  customerId?: string;
  workOrderId?: string;
  checkedOutAt?: string;
  expectedBack?: string;
  checkedInAt?: string;
  mileageOut?: number;
  mileageIn?: number;
  fuelLevelOut?: string;
  fuelLevelIn?: string;
  damageNotes?: string;
}

const statusColor: Record<string, string> = { available: '#22c55e', out: '#e5332a', maintenance: '#f59e0b' };
const fuelOptions = ['Full', '3/4', '1/2', '1/4', 'Empty'];

export default function LoanersPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'admin']);
  const [loaners, setLoaners] = useState<Loaner[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'out' | 'maintenance'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [modalLoaner, setModalLoaner] = useState<Loaner | null>(null);
  const [modalMode, setModalMode] = useState<'checkout' | 'checkin' | 'edit'>('checkout');
  const [form, setForm] = useState<Partial<Loaner>>({});
  const [saving, setSaving] = useState(false);
  const [deleteLoanerId, setDeleteLoanerId] = useState<string|null>(null);

  useEffect(() => {
    if (!user) return;
    fetchLoaners();
  }, [user]);

  const fetchLoaners = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/loaners', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setLoaners(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const save = async (data: Partial<Loaner>) => {
    setSaving(true);
    const token = localStorage.getItem('token');
    if (showAdd) {
      await fetch('/api/loaners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      setShowAdd(false);
    } else if (modalLoaner) {
      await fetch(`/api/loaners/${modalLoaner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      setModalLoaner(null);
    }
    setForm({});
    fetchLoaners();
    setSaving(false);
  };

  const deleteLoaner = (id: string) => {
    setDeleteLoanerId(id);
  };

  const doDeleteLoaner = async () => {
    if (!deleteLoanerId) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/loaners/${deleteLoanerId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleteLoanerId(null);
    fetchLoaners();
  };

  const openCheckout = (loaner: Loaner) => {
    setModalLoaner(loaner);
    setModalMode('checkout');
    setForm({ mileageOut: loaner.mileageOut, fuelLevelOut: loaner.fuelLevelOut, expectedBack: loaner.expectedBack });
  };

  const openCheckin = (loaner: Loaner) => {
    setModalLoaner(loaner);
    setModalMode('checkin');
    setForm({ mileageIn: loaner.mileageIn, fuelLevelIn: loaner.fuelLevelIn, damageNotes: loaner.damageNotes });
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const available = loaners.filter(l => l.status === 'available').length;
  const out = loaners.filter(l => l.status === 'out').length;
  const maintenance = loaners.filter(l => l.status === 'maintenance').length;

  const filteredLoaners = loaners.filter((l) => {
    const statusOk = statusFilter === 'all' ? true : l.status === statusFilter;
    const haystack = `${l.year} ${l.make} ${l.model} ${l.licensePlate || ''} ${l.vin || ''}`.toLowerCase();
    const searchOk = searchTerm.trim() ? haystack.includes(searchTerm.toLowerCase()) : true;
    return statusOk && searchOk;
  });

  const F = (k: keyof Loaner) => (
    <div key={String(k)} style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
        {k === 'vin' ? 'VIN' : String(k).replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
      </label>
      <input
        value={String((form as any)[k] || '')}
        onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
      />
    </div>
  );

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaCar style={{marginRight:4}} /> Loaner Vehicles</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>{available} available · {out} checked out · {maintenance} in maintenance</p>
        </div>
        <button onClick={() => { setShowAdd(true); setForm({}); }} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Add Loaner</button>
      </div>

      <div style={{ padding: '16px 32px 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search make, model, plate, VIN"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'available', label: 'Available' },
            { id: 'out', label: 'Checked Out' },
            { id: 'maintenance', label: 'Maintenance' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as typeof statusFilter)}
              style={{
                background: statusFilter === f.id ? '#e5332a' : 'rgba(255,255,255,0.05)',
                color: statusFilter === f.id ? 'white' : '#cbd5e1',
                border: `1px solid ${statusFilter === f.id ? '#e5332a' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ textAlign: 'center', color: '#6b7280', padding: 64 }}>Loading...</div> :
          filteredLoaners.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaCar style={{marginRight:4}} /></div>
              <div style={{ fontSize: 20, fontWeight: 600, margin: '16px 0 8px' }}>{loaners.length === 0 ? 'No loaner vehicles' : 'No loaners match your filters'}</div>
              <button onClick={() => { setShowAdd(true); setForm({}); }} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>+ Add First Loaner</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {filteredLoaners.map(loaner => (
                <div key={loaner.id} style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${statusColor[loaner.status]}40`, borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>{loaner.year} {loaner.make} {loaner.model}</div>
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>{loaner.color} · {loaner.licensePlate}</div>
                    </div>
                    <span style={{ background: statusColor[loaner.status], color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      {loaner.status}
                    </span>
                  </div>
                  {loaner.status === 'out' && (
                    <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 12 }}>
                      {loaner.checkedOutAt && <div><span style={{ color: '#9ca3af' }}>Out since: </span>{new Date(loaner.checkedOutAt).toLocaleString()}</div>}
                      {loaner.expectedBack && <div><span style={{ color: '#9ca3af' }}>Due back: </span><span style={{ color: '#f59e0b' }}>{new Date(loaner.expectedBack).toLocaleDateString()}</span></div>}
                      {loaner.mileageOut && <div><span style={{ color: '#9ca3af' }}>Mileage out: </span>{loaner.mileageOut.toLocaleString()}</div>}
                    </div>
                  )}
                  {loaner.damageNotes && (
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#fbbf24', marginBottom: 12 }}>
                      <FaExclamationTriangle style={{marginRight:4}} /> {loaner.damageNotes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {loaner.status === 'available' && (
                      <button onClick={() => openCheckout(loaner)} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Check Out</button>
                    )}
                    {loaner.status === 'out' && (
                      <button onClick={() => openCheckin(loaner)} style={{ flex: 1, background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid #22c55e', borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Check In</button>
                    )}
                    <button onClick={() => deleteLoaner(loaner.id)} style={{ background: 'transparent', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}><FaTrash style={{marginRight:4}} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 440, maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Add Loaner Vehicle</h3>
            {(['make', 'model', 'year', 'color', 'licensePlate', 'vin'] as (keyof Loaner)[]).map(k => F(k))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => save({ ...form, status: 'available' })} disabled={saving}
                style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Add Vehicle'}
              </button>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout/Checkin Modal */}
      {modalLoaner && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 440, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{modalMode === 'checkout' ? <><FaArrowUp style={{marginRight:4}} /> Check Out</> : <><FaArrowDown style={{marginRight:4}} /> Check In</>}: {modalLoaner.year} {modalLoaner.make} {modalLoaner.model}</h3>
            <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 0, marginBottom: 20 }}>Record condition before {modalMode === 'checkout' ? 'lending' : 'returning'}</p>

            {modalMode === 'checkout' ? (
              <>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Customer / Work Order</label>
                <input value={String(form.customerId || '')} onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))}
                  placeholder="Customer name or ID"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Mileage Out</label>
                <input type="number" value={String(form.mileageOut || '')} onChange={e => setForm(p => ({ ...p, mileageOut: Number(e.target.value) }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Fuel Level</label>
                <select value={form.fuelLevelOut || 'Full'} onChange={e => setForm(p => ({ ...p, fuelLevelOut: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 14 }}>
                  {fuelOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Expected Return Date</label>
                <input type="date" value={String(form.expectedBack || '')} onChange={e => setForm(p => ({ ...p, expectedBack: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />
              </>
            ) : (
              <>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Mileage In</label>
                <input type="number" value={String(form.mileageIn || '')} onChange={e => setForm(p => ({ ...p, mileageIn: Number(e.target.value) }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Fuel Level Returned</label>
                <select value={form.fuelLevelIn || 'Full'} onChange={e => setForm(p => ({ ...p, fuelLevelIn: e.target.value }))}
                  style={{ width: '100%', background: '#374151', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 14 }}>
                  {fuelOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Damage Notes</label>
                <textarea value={String(form.damageNotes || '')} onChange={e => setForm(p => ({ ...p, damageNotes: e.target.value }))}
                  rows={3} placeholder="Any new damage, scratches, etc. (leave blank if none)"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, marginBottom: 16, resize: 'vertical', boxSizing: 'border-box' }} />
              </>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => save({
                ...form,
                status: modalMode === 'checkout' ? 'out' : 'available',
                checkedOutAt: modalMode === 'checkout' ? new Date().toISOString() : modalLoaner.checkedOutAt,
                checkedInAt: modalMode === 'checkin' ? new Date().toISOString() : undefined,
              })} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : modalMode === 'checkout' ? 'Confirm Check Out' : 'Confirm Check In'}
              </button>
              <button onClick={() => setModalLoaner(null)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteLoanerId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#1f2937',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:28,maxWidth:360,width:'90%'}}>
            <h3 style={{color:'#e5e7eb',fontSize:18,fontWeight:700,marginBottom:8}}>Remove Loaner Vehicle?</h3>
            <p style={{color:'#9ca3af',fontSize:14,marginBottom:20}}>This action cannot be undone.</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={doDeleteLoaner} style={{flex:1,padding:'10px 0',background:'#e5332a',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Remove</button>
              <button onClick={()=>setDeleteLoanerId(null)} style={{flex:1,padding:'10px 0',background:'transparent',color:'#9ca3af',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
