'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaEnvelope, FaExclamationTriangle, FaMapMarkerAlt, FaPhone, FaStar } from 'react-icons/fa';

interface ShopLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  isMain: boolean;
  status: 'active' | 'inactive';
  notes: string;
  createdAt: string;
}

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const BLANK: { name: string; address: string; city: string; state: string; zip: string; phone: string; email: string; isMain: boolean; status: 'active' | 'inactive'; notes: string } = { name: '', address: '', city: '', state: 'TX', zip: '', phone: '', email: '', isMain: false, status: 'active', notes: '' };

export default function ShopLocationsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteLocInfo, setDeleteLocInfo] = useState<{id:string;name:string}|null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await fetch('/api/shop/locations', { headers });
      const data = await res.json();
      setLocations(data.locations ?? []);
    } catch { setError('Failed to load locations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const openCreate = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true); setError(null); };
  const openEdit = (l: ShopLocation) => {
    setEditId(l.id);
    setForm({ name: l.name, address: l.address, city: l.city, state: l.state, zip: l.zip, phone: l.phone, email: l.email, isMain: l.isMain, status: l.status, notes: l.notes });
    setShowForm(true); setError(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.address || !form.city || !form.state) { setError('Name, address, city, and state are required'); return; }
    setSaving(true); setError(null);
    try {
      const url = editId ? `/api/shop/locations/${editId}` : '/api/shop/locations';
      const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess(editId ? 'Location updated!' : 'Location added!');
      setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleSetMain = async (id: string) => {
    try {
      await fetch(`/api/shop/locations/${id}`, { method: 'PUT', headers, body: JSON.stringify({ isMain: true }) });
      load();
    } catch { setError('Update failed'); }
  };

  const handleDelete = async (id: string, name: string, isMain: boolean) => {
    if (isMain) { setError('Cannot delete the main location. Set another as main first.'); return; }
    setDeleteLocInfo({ id, name });
  };

  const doDelete = async () => {
    if (!deleteLocInfo) return;
    try {
      await fetch(`/api/shop/locations/${deleteLocInfo.id}`, { method: 'DELETE', headers });
      setSuccess('Location deleted'); load();
    } catch { setError('Delete failed'); }
    setDeleteLocInfo(null);
  };

  const bg = 'transparent';
  if (isLoading || loading) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <Link href="/shop/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}><FaArrowLeft style={{marginRight:4}} /> Admin</Link>
            <h1 style={{ color: '#f1f5f9', fontSize: 26, fontWeight: 700, margin: '4px 0 4px' }}><FaMapMarkerAlt style={{marginRight:4}} /> Shop Locations</h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Manage multiple shop branches and service locations</p>
          </div>
          <button onClick={openCreate} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#e5332a', color: 'white', fontWeight: 600, cursor: 'pointer' }}>+ Add Location</button>
        </div>

        {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#86efac', fontSize: 14 }}>{success}</div>}
        {error && !showForm && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#fca5a5', fontSize: 14 }}>{error}</div>}

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Locations', value: locations.length, color: '#ff6b64' },
            { label: 'Active', value: locations.filter(l => l.status === 'active').length, color: '#34d399' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 20px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <span style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value} </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {locations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}><FaMapMarkerAlt style={{marginRight:4}} /></div>
            <p style={{ fontSize: 16 }}>No locations added yet</p>
            <p style={{ fontSize: 14 }}>Add your first shop location to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {locations.map((l) => (
              <div key={l.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, border: `1px solid ${l.isMain ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`, position: 'relative' }}>
                {l.isMain && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: 11, padding: '3px 8px', borderRadius: 10, fontWeight: 600 }}>
                    <FaStar style={{marginRight:4}} /> MAIN
                  </div>
                )}
                <h3 style={{ color: '#f1f5f9', fontWeight: 700, margin: '0 0 8px', fontSize: 17 }}>{l.name}</h3>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8 }}>
                  <div><FaMapMarkerAlt style={{marginRight:4}} /> {l.address}</div>
                  <div>{l.city}, {l.state} {l.zip}</div>
                  {l.phone && <div><FaPhone style={{marginRight:4}} /> {l.phone}</div>}
                  {l.email && <div><FaEnvelope style={{marginRight:4}} /> {l.email}</div>}
                </div>
                {l.status === 'inactive' && <div style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}><FaExclamationTriangle style={{marginRight:4}} /> Inactive</div>}
                {l.notes && <p style={{ color: '#64748b', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>{l.notes}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, flexWrap: 'wrap' }}>
                  {!l.isMain && (
                    <button onClick={() => handleSetMain(l.id)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(251,191,36,0.4)', background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontSize: 12 }}>Set Main</button>
                  )}
                  <button onClick={() => openEdit(l)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                  {!l.isMain && (
                    <button onClick={() => handleDelete(l.id, l.name, l.isMain)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editId ? 'Edit Location' : 'Add New Location'}</h2>
              {[
                { label: 'Location Name *', key: 'name', placeholder: 'e.g. Downtown Branch' },
                { label: 'Street Address *', key: 'address', placeholder: '123 Main St' },
                { label: 'City *', key: 'city', placeholder: 'Houston' },
                { label: 'ZIP Code', key: 'zip', placeholder: '77001' },
                { label: 'Phone', key: 'phone', placeholder: '(555) 000-0000' },
                { label: 'Email', key: 'email', placeholder: 'branch@shop.com' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>{label}</label>
                  <input value={(form as any)[key]} placeholder={placeholder}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>State *</label>
                  <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#f1f5f9', fontSize: 14 }}>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b', color: '#f1f5f9', fontSize: 14 }}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="isMain" checked={form.isMain} onChange={(e) => setForm({ ...form, isMain: e.target.checked })} />
                <label htmlFor="isMain" style={{ color: '#94a3b8', fontSize: 14 }}>Set as main location</label>
              </div>
              {error && <p style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#e5332a', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Saving...' : editId ? 'Update Location' : 'Add Location'}
                </button>
                <button onClick={() => { setShowForm(false); setError(null); }} style={{ padding: '11px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteLocInfo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#1f2937',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:28,maxWidth:380,width:'90%'}}>
            <h3 style={{color:'#e5e7eb',fontSize:18,fontWeight:700,marginBottom:8}}>Delete Location?</h3>
            <p style={{color:'#9aa3b2',fontSize:14,marginBottom:20}}>Delete <strong style={{color:'#e5e7eb'}}>{deleteLocInfo.name}</strong>? This cannot be undone.</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={doDelete} style={{flex:1,padding:'10px 0',background:'#ef4444',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Delete</button>
              <button onClick={()=>setDeleteLocInfo(null)} style={{flex:1,padding:'10px 0',background:'transparent',color:'#9aa3b2',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

