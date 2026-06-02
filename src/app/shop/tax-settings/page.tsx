'use client';
import { useState, useEffect } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { FaBox, FaDollarSign, FaReceipt, FaWrench } from 'react-icons/fa';

interface TaxRule {
  id: string;
  name: string;
  rate: number;
  appliesToParts: boolean;
  appliesToLabor: boolean;
  appliesToFees: boolean;
  state?: string;
  county?: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function TaxSettingsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', rate: '', appliesToParts: true, appliesToLabor: true, appliesToFees: false, state: '', county: '', isDefault: false, isActive: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editRule, setEditRule] = useState<TaxRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [taxMsg, setTaxMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  const load = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/tax-rules', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setRules(await r.json());
    setLoading(false);
  };

  useEffect(() => { if (!user) return; load(); }, [user]);

  const save = async () => {
    if (!form.name || !form.rate) { setFormError('Name and rate are required.'); return; }
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch('/api/tax-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, rate: Number(form.rate) }),
    });
    if (r.ok) { setShowForm(false); setForm({ name: '', rate: '', appliesToParts: true, appliesToLabor: true, appliesToFees: false, state: '', county: '', isDefault: false, isActive: true }); load(); }
    else { setFormError('Failed to save tax rule.'); }
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editRule) return;
    if (!editRule.name || !editRule.rate) { setFormError('Name and rate are required.'); return; }
    setSaving(true);
    const token = localStorage.getItem('token');
    const r = await fetch(`/api/tax-rules/${editRule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...editRule }),
    });
    if (r.ok) { setEditRule(null); load(); setTaxMsg({type:'success',text:'Tax rule updated.'}); }
    else { setFormError('Failed to update tax rule.'); }
    setSaving(false);
  };

  const deleteRule = async (id: string) => {
    const token = localStorage.getItem('token');
    const r = await fetch(`/api/tax-rules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleteConfirmId(null);
    if (r.ok) { load(); setTaxMsg({type:'success',text:'Tax rule deleted.'}); }
    else { setTaxMsg({type:'error',text:'Failed to delete tax rule.'}); }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div className="centered-app-page" style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}><FaReceipt style={{marginRight:4}} /> Tax Rules</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>Configure tax rates for parts, labor, and fees</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Add Tax Rule</button>
      </div>

      <div style={{ padding: 32 }}>
        {loading ? <div style={{ color: '#6b7280' }}>Loading...</div> :
          rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ fontSize: 64 }}><FaReceipt style={{marginRight:4}} /></div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>No tax rules configured</div>
              <div style={{ color: '#9ca3af', marginBottom: 24 }}>Add your local tax rates to automatically apply taxes to invoices</div>
              <button onClick={() => setShowForm(true)} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Add First Tax Rule</button>
            </div>
          ) : (
            <div>
              {rules.map(rule => (
                <div key={rule.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${rule.isDefault ? 'rgba(229,51,42,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {rule.name}
                        {rule.isDefault && <span style={{ background: 'rgba(229,51,42,0.2)', color: '#e5332a', border: '1px solid #e5332a', borderRadius: 20, padding: '1px 10px', fontSize: 11, fontWeight: 700 }}>Default</span>}
                        {!rule.isActive && <span style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af', borderRadius: 20, padding: '1px 10px', fontSize: 11 }}>Inactive</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                        {rule.state && `${rule.state}${rule.county ? `  ${rule.county}` : ''}  `}
                        {rule.appliesToParts && <><FaBox style={{marginRight:4}} /> Parts </>}{rule.appliesToLabor && <><FaWrench style={{marginRight:4}} /> Labor </>}{rule.appliesToFees && <><FaDollarSign style={{marginRight:4}} /> Fees</>}
                      </div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#ff6b64' }}>{rule.rate}%</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => { setEditRule(rule); setFormError(''); }} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '6px 0', fontSize: 12, color: '#e5e7eb', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => setDeleteConfirmId(rule.id)} style={{ background: 'rgba(229,51,42,0.15)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 7, padding: '6px 16px', fontSize: 12, color: '#e5332a', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 440, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Add Tax Rule</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Rule Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="State Sales Tax"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Rate (%) *</label>
                <input value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} type="number" step="0.001" placeholder="8.875"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>State</label>
                <input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} placeholder="NY"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>County (optional)</label>
                <input value={form.county} onChange={e => setForm(p => ({ ...p, county: e.target.value }))} placeholder="Nassau"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Applies To</label>
              {[['appliesToParts', ' Parts'], ['appliesToLabor', ' Labor'], ['appliesToFees', ' Environmental Fees']].map(([k, label]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.checked }))} />
                  {label}
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} />
                Set as default tax rule
              </label>
            </div>

            {formError && (
              <div style={{ marginBottom: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 14px', color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>{formError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Rule'}</button>
      <button onClick={() => { setShowForm(false); }} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editRule && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, width: 440, maxWidth: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Edit Tax Rule</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Rule Name *</label>
                <input value={editRule.name} onChange={e => setEditRule(p => p ? { ...p, name: e.target.value } : p)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Rate (%) *</label>
                <input value={editRule.rate} onChange={e => setEditRule(p => p ? { ...p, rate: Number(e.target.value) } : p)} type="number" step="0.001" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[['appliesToParts', ' Parts'], ['appliesToLabor', ' Labor'], ['appliesToFees', ' Environmental Fees']].map(([k, label]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={(editRule as any)[k]} onChange={e => setEditRule(p => p ? { ...p, [k]: e.target.checked } : p)} />
                  {label}
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={editRule.isDefault} onChange={e => setEditRule(p => p ? { ...p, isDefault: e.target.checked } : p)} />
                Set as default
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={editRule.isActive} onChange={e => setEditRule(p => p ? { ...p, isActive: e.target.checked } : p)} />
                Active
              </label>
            </div>
            {formError && <div style={{ marginBottom: 12, background: 'rgba(239,68,68,0.15)', borderRadius: 8, padding: '8px 14px', color: '#fca5a5', fontSize: 13 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditRule(null)} style={{ flex: 1, background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 0', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1f2937', borderRadius: 14, padding: 32, minWidth: 300, maxWidth: 420 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}>Delete Tax Rule?</h3>
            <p style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 24 }}>This will permanently remove the tax rule. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => deleteRule(deleteConfirmId)} style={{ flex: 1, padding: '10px 0', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '10px 0', background: 'transparent', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {taxMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:taxMsg.type==='success'?'#dcfce7':'#fde8e8',color:taxMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {taxMsg.text}
          <button onClick={()=>setTaxMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}

