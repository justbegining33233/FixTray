'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBox, FaCheck, FaEdit, FaTimes, FaTools, FaTrash, FaWrench } from 'react-icons/fa';

// -- FixTray Service Catalog --------------------------------------------------
const CATALOG: Record<string, string[]> = {
  diesel: [
    'Engine Diagnostics','Engine Repair','Engine Rebuild','Transmission Repair',
    'Brake System','Air Brake Service','Electrical Diagnostics','Electrical Repair',
    'Tire Service','Tire Replacement','Wheel Alignment','Suspension Repair',
    'Hydraulic Systems','Air Conditioning','Exhaust Repair','DEF System',
    'DPF Cleaning','Oil Change','Preventive Maintenance','DOT Inspections',
    'Trailer Repair','Reefer Repair','Welding','Roadside Assistance',
  ],
  gas: [
    'Engine Diagnostics','Engine Repair','Transmission Service','Transmission Repair',
    'Brake Service','Brake Replacement','Oil Change','Tune-up','Electrical Diagnostics',
    'Electrical Repair','Battery Service','Tire Rotation','Tire Replacement',
    'Wheel Alignment','Suspension Repair','Air Conditioning','Heating Repair',
    'Exhaust Repair','Catalytic Converter','Emissions Testing','State Inspection',
    'Windshield Replacement','Fluid Service','Coolant Flush','Fuel System Cleaning',
    'Timing Belt','Roadside Assistance',
  ],
  'small-engine': [
    'Engine Diagnostics','Carburetor Cleaning & Rebuild','Fuel System Repair',
    'Ignition System Repair','Spark Plug Replacement','Oil Change & Filter Service',
    'Air Filter Cleaning/Replacement','Tune-Up','Blade Sharpening','Belt Replacement',
    'Starter Repair','Recoil Starter Repair','Compression Testing',
    'Two-Stroke / Four-Stroke Service','Chain Sharpening (Chainsaws)',
    'String Trimmer Repair','Blower Repair','Generator Service',
    'Pressure Washer Repair','Preventive Maintenance','Parts Replacement',
    'Winterization / Storage Prep',
  ],
  'heavy-equipment': [
    'Hydraulic System Diagnostics & Repair','Hydraulic Cylinder Rebuild',
    'Undercarriage Inspection & Repair','Track / Chain Replacement',
    'Sprocket & Roller Replacement','Final Drive Repair','Engine Diagnostics & Repair',
    'Transmission Service & Repair','Boom & Arm Repair','Bucket / Blade Repair',
    'Pin & Bushing Replacement','Electrical System Repair','Brake System Service',
    'Cooling System Flush & Repair','Preventive Maintenance','Field Service / On-Site Repair',
    'Welding & Fabrication Repair','Pump Repair','Valve Adjustment',
    'Heavy Equipment Inspections',
  ],
  resurfacing: [
    'Cylinder Head Resurfacing','Engine Block Resurfacing','Flywheel Resurfacing',
    'Brake Rotor Resurfacing','Surface Grinding','Milling & Machining','Line Boring',
    'Valve Seat Cutting','Crankshaft Grinding','Align Boring',
    'Sleeving / Boring Engine Cylinders','Precision Measurement & Inspection',
    'Custom Machining','Head Gasket Surface Prep','Deck Surfacing',
  ],
  welding: [
    'MIG Welding','TIG Welding','Stick Welding','Aluminum Welding',
    'Stainless Steel Welding','Cast Iron Repair Welding','Structural Welding',
    'Custom Fabrication','Weld Repairs','Hardfacing / Wear Resistant Overlay',
    'Mobile / On-Site Welding','Pipe Welding','Trailer & Frame Repair',
    'Heavy Equipment Weld Repair','Metal Cutting & Preparation',
    'Weld Inspection & Testing',
  ],
  tire: [
    'Tire Replacement','Tire Installation','Flat Tire Repair','Tire Patching',
    'Tire Rotation','Wheel Balancing','Wheel Alignment',
    'Tire Pressure Monitoring System (TPMS) Service','TPMS Sensor Replacement',
    'Tire Inspection','Tread Depth Check','Tire Mounting','Tire Demounting',
    'Run-Flat Tire Service','Custom Wheel Installation','Tire Storage',
    'Valve Stem Replacement','Bead Seating','Nitrogen Inflation Service',
    'Tire Size Consultation','Seasonal Tire Changeover','Commercial Tire Service',
    'Agricultural / Off-Road Tire Service','Forklift Tire Service',
    'Trailer Tire Service',
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  diesel: 'Diesel / Heavy-Duty',
  gas: 'Gas / Automotive',
  'small-engine': 'Small Engine',
  'heavy-equipment': 'Heavy Equipment',
  resurfacing: 'Resurfacing / Machining',
  welding: 'Welding & Fabrication',
  tire: 'Tire Shop',
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  diesel:            { bg: 'rgba(229,51,42,0.18)',  border: 'rgba(229,51,42,0.35)',  text: '#ff6b64' },
  gas:               { bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.35)',   text: '#4ade80' },
  'small-engine':    { bg: 'rgba(251,191,36,0.18)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
  'heavy-equipment': { bg: 'rgba(168,85,247,0.18)',  border: 'rgba(168,85,247,0.35)',  text: '#c084fc' },
  resurfacing:       { bg: 'rgba(236,72,153,0.18)',  border: 'rgba(236,72,153,0.35)',  text: '#f472b6' },
  welding:           { bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  tire:              { bg: 'rgba(20,184,166,0.18)',  border: 'rgba(20,184,166,0.35)',  text: '#2dd4bf' },
};

const ALL_CATEGORIES = Object.keys(CATALOG);

const PAGE_BG = 'transparent';
const CARD_BG = 'rgba(255,255,255,0.05)';
const CARD_BORDER = '1px solid rgba(255,255,255,0.1)';

type TabId = 'my' | 'catalog' | 'custom';

export default function ShopServicesPage() {
  useRequireAuth(['shop']);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState('');
  const [shopType, setShopType] = useState<string>('mixed');

  const [activeTab, setActiveTab] = useState<TabId>('my');
  const [filterCat, setFilterCat] = useState('all');

  // Edit modal
  const [editingService, setEditingService] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ serviceName: '', category: 'diesel', price: '', duration: '', description: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Custom tab
  const [customForm, setCustomForm] = useState({ serviceName: '', category: 'diesel', price: '', duration: '', description: '' });
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState('');
  const [customSuccess, setCustomSuccess] = useState('');

  // Catalog tab
  const [catalogPrices, setCatalogPrices] = useState<Record<string, string>>({});
  const [addingCatalog, setAddingCatalog] = useState<string | null>(null);
  const [catalogSuccess, setCatalogSuccess] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [catalogFilterCat, setCatalogFilterCat] = useState('all');

  useEffect(() => {
    const id = localStorage.getItem('shopId') || '';
    const token = localStorage.getItem('token');
    setShopId(id);

    Promise.all([
      fetch(`/api/services?shopId=${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/shops/complete-profile?shopId=${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([svcRes, profileRes]) => {
      if (svcRes.ok) {
        const d = await svcRes.json();
        setServices(d.services || []);
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        const st: string = p.shopType || 'mixed';
        setShopType(st);
        // shopType only sets which category is pre-selected in the catalog filter
        const defaultCat = (st === 'mixed' || !CATALOG[st]) ? 'diesel' : st;
        setCatalogFilterCat(defaultCat);
      }
    }).finally(() => setLoading(false));
  }, []);

  const reload = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/services?shopId=${shopId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setServices(d.services || []); }
  };

  const openEdit = (svc: any) => {
    setEditingService(svc);
    setEditForm({ serviceName: svc.serviceName, category: svc.category, price: svc.price?.toString() || '', duration: svc.duration?.toString() || '', description: svc.description || '' });
    setShowEditModal(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/services/${editingService.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shopId, serviceName: editForm.serviceName, category: editForm.category, price: editForm.price ? parseFloat(editForm.price) : null, duration: editForm.duration ? parseInt(editForm.duration) : null, description: editForm.description || null }),
    });
    setEditSaving(false);
    if (res.ok) { setShowEditModal(false); setEditingService(null); reload(); }
    else { const d = await res.json(); setEditError(d.error || 'Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/services/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleteConfirmId(null);
    reload();
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSaving(true); setCustomError(''); setCustomSuccess('');
    const token = localStorage.getItem('token');
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shopId, serviceName: customForm.serviceName, category: customForm.category, price: customForm.price ? parseFloat(customForm.price) : undefined, duration: customForm.duration ? parseInt(customForm.duration) : undefined, description: customForm.description || undefined }),
    });
    setCustomSaving(false);
    if (res.ok) {
      setCustomSuccess(`"${customForm.serviceName}" added to your catalog.`);
      setCustomForm({ serviceName: '', category: customForm.category, price: '', duration: '', description: '' });
      reload();
    } else {
      const d = await res.json();
      setCustomError(d.error || 'Failed to add service');
    }
  };

  const addFromCatalog = async (serviceName: string, category: string) => {
    const key = `${category}::${serviceName}`;
    setAddingCatalog(key); setCatalogSuccess('');
    const token = localStorage.getItem('token');
    const price = catalogPrices[key] ? parseFloat(catalogPrices[key]) : undefined;
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shopId, serviceName, category, price }),
    });
    setAddingCatalog(null);
    if (res.ok) { setCatalogSuccess(`"${serviceName}" added!`); reload(); setTimeout(() => setCatalogSuccess(''), 3000); }
    else { const d = await res.json(); setCatalogError(d.error || 'Failed to add'); setTimeout(() => setCatalogError(''), 4000); }
  };

  const activeCats = ALL_CATEGORIES.filter(c => services.some(s => s.category === c));
  const filteredServices = filterCat === 'all' ? services : services.filter(s => s.category === filterCat);
  const addedSet = new Set(services.map(s => `${s.category}::${s.serviceName}`));
  const catalogCategories = catalogFilterCat === 'all' ? ALL_CATEGORIES : [catalogFilterCat];

  const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '11px 14px', color: '#f1f5f9', fontSize: 14, boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6, fontWeight: 500 };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb', fontSize: 18 }}>Loading services...</div>
  );

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/shop/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}><FaArrowLeft style={{marginRight:4}} /> Admin</Link>
          <div style={{ marginTop: 6 }}>
            <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 700, margin: 0 }}><FaTools style={{marginRight:4}} /> Service Catalog</h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
              {services.length} service{services.length !== 1 ? 's' : ''} active  Shop type: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{CATEGORY_LABELS[shopType] || shopType}</span>
            </p>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {([
            { id: 'my' as TabId,      label: ` My Services (${services.length})` },
            { id: 'catalog' as TabId, label: ' FixTray Catalog' },
            { id: 'custom' as TabId,  label: ' Add Custom' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '9px 18px', borderRadius: 7, border: 'none', background: activeTab === tab.id ? '#e5332a' : 'transparent', color: activeTab === tab.id ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* -- TAB 1: MY SERVICES -- */}
        {activeTab === 'my' && (
          <>
            {activeCats.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {['all', ...activeCats].map(cat => {
                  const col = CATEGORY_COLORS[cat] || { bg: 'transparent', border: 'rgba(255,255,255,0.15)', text: '#94a3b8' };
                  const active = filterCat === cat;
                  return (
                    <button key={cat} onClick={() => setFilterCat(cat)}
                      style={{ padding: '7px 16px', borderRadius: 20, border: `1px solid ${active ? col.border : 'rgba(255,255,255,0.12)'}`, background: active ? col.bg : 'transparent', color: active ? col.text : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {cat === 'all' ? `All (${services.length})` : `${CATEGORY_LABELS[cat] || cat} (${services.filter(s => s.category === cat).length})`}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredServices.length === 0 ? (
              <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><FaWrench style={{marginRight:4}} /></div>
                <h3 style={{ color: '#e5e7eb', marginBottom: 8 }}>No services yet</h3>
                <p style={{ color: '#64748b', marginBottom: 20 }}>Add services from the FixTray Catalog or create a custom one.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => setActiveTab('catalog')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#e5332a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}><FaBox style={{marginRight:4}} /> Browse Catalog</button>
                  <button onClick={() => setActiveTab('custom')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#e5e7eb', fontWeight: 600, cursor: 'pointer' }}><FaEdit style={{marginRight:4}} /> Add Custom</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
                {filteredServices.map(svc => {
                  const col = CATEGORY_COLORS[svc.category] || CATEGORY_COLORS.diesel;
                  return (
                    <div key={svc.id} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>{svc.serviceName}</h3>
                          <span style={{ display: 'inline-block', background: col.bg, border: `1px solid ${col.border}`, color: col.text, padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                            {CATEGORY_LABELS[svc.category] || svc.category}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                          <button onClick={() => openEdit(svc)} style={{ background: 'rgba(229,51,42,0.2)', border: 'none', color: '#ff6b64', padding: '5px 11px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit</button>
                          <button onClick={() => setDeleteConfirmId(svc.id)} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#f87171', padding: '5px 11px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><FaTimes style={{marginRight:4}} /></button>
                        </div>
                      </div>
                      {svc.description && <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 10px' }}>{svc.description}</p>}
                      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                        {svc.price != null && (
                          <div><span style={{ color: '#64748b' }}>Price </span><span style={{ color: '#f1f5f9', fontWeight: 700 }}>${svc.price.toFixed(2)}</span></div>
                        )}
                        {svc.duration && (
                          <div><span style={{ color: '#64748b' }}>Duration </span><span style={{ color: '#f1f5f9', fontWeight: 600 }}>{svc.duration} min</span></div>
                        )}
                        {svc.price == null && !svc.duration && (
                          <span style={{ color: '#475569', fontSize: 12 }}>No pricing set  -  <button onClick={() => openEdit(svc)} style={{ background: 'none', border: 'none', color: '#ff6b64', cursor: 'pointer', fontSize: 12, padding: 0 }}>add price</button></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* -- TAB 2: FIXTRAY CATALOG -- */}
        {activeTab === 'catalog' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                Click <strong style={{ color: '#f1f5f9' }}>+ Add</strong> to instantly add a FixTray service to your catalog. Optionally set a price first. Services already added show <FaCheck style={{marginRight:4}} />.
              </p>
              {catalogSuccess && (
                <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 7, padding: '7px 14px', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>{catalogSuccess}</div>
              )}
              {catalogError && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, padding: '7px 14px', color: '#f87171', fontSize: 13, fontWeight: 600 }}>{catalogError}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {(['all', ...ALL_CATEGORIES]).map(cat => {
                const col = CATEGORY_COLORS[cat] || { bg: 'transparent', border: 'rgba(255,255,255,0.15)', text: '#94a3b8' };
                const active = catalogFilterCat === cat;
                return (
                  <button key={cat} onClick={() => setCatalogFilterCat(cat)}
                    style={{ padding: '7px 16px', borderRadius: 20, border: `1px solid ${active ? col.border : 'rgba(255,255,255,0.12)'}`, background: active ? col.bg : 'transparent', color: active ? col.text : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {cat === 'all' ? 'All Categories' : CATEGORY_LABELS[cat] || cat}
                  </button>
                );
              })}
            </div>

            {catalogCategories.map(cat => {
              const col = CATEGORY_COLORS[cat] || CATEGORY_COLORS.diesel;
              const catServices = CATALOG[cat] || [];
              const notAdded = catServices.filter(s => !addedSet.has(`${cat}::${s}`));
              const added = catServices.filter(s => addedSet.has(`${cat}::${s}`));
              return (
                <div key={cat} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text, padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span style={{ color: '#475569', fontSize: 12 }}>{added.length}/{catServices.length} added</span>
                    {notAdded.length === 0 && <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }}><FaCheck style={{marginRight:4}} /> All added</span>}
                  </div>

                  {notAdded.length > 0 && (
                    <div style={{ display: 'grid', gap: 8, marginBottom: added.length > 0 ? 14 : 0 }}>
                      {notAdded.map(svcName => {
                        const key = `${cat}::${svcName}`;
                        const isAdding = addingCatalog === key;
                        return (
                          <div key={svcName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                            <span style={{ flex: 1, color: '#e2e8f0', fontSize: 14 }}>{svcName}</span>
                            <input
                              type="number"
                              placeholder="Price $"
                              value={catalogPrices[key] || ''}
                              onChange={e => setCatalogPrices(prev => ({ ...prev, [key]: e.target.value }))}
                              style={{ width: 90, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 8px', color: '#f1f5f9', fontSize: 13 }}
                            />
                            <button
                              onClick={() => addFromCatalog(svcName, cat)}
                              disabled={isAdding}
                              style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${col.border}`, background: isAdding ? 'rgba(229,51,42,0.3)' : col.bg, color: col.text, fontSize: 13, fontWeight: 700, cursor: isAdding ? 'default' : 'pointer', minWidth: 60 }}>
                              {isAdding ? '...' : '+ Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {added.length > 0 && (
                    <details>
                      <summary style={{ color: '#475569', fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                        <FaCheck style={{marginRight:4}} /> {added.length} already in your catalog
                      </summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {added.map(svcName => (
                          <span key={svcName} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', padding: '4px 10px', borderRadius: 5, fontSize: 12 }}>
                            <FaCheck style={{marginRight:4}} /> {svcName}
                          </span>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* -- TAB 3: CUSTOM SERVICE -- */}
        {activeTab === 'custom' && (
          <div style={{ maxWidth: 540 }}>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
              Add a service that isn&apos;t in the FixTray catalog  -  unique offerings, specialty work, or anything specific to your shop.
            </p>

            {customError && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>{customError}</div>
            )}
            {customSuccess && (
              <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', color: '#86efac', fontSize: 14, marginBottom: 16 }}>{customSuccess}</div>
            )}

            <form onSubmit={handleCustomSubmit} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 28 }}>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Service Name *</label>
                <input required value={customForm.serviceName} onChange={e => setCustomForm(p => ({ ...p, serviceName: e.target.value }))} style={inputStyle} placeholder="e.g. Custom Lift Kit Install" />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Category *</label>
                <select required value={customForm.category} onChange={e => setCustomForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle, appearance: 'auto' }}>
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ background: '#1e293b' }}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div>
                  <label style={labelStyle}>Price ($)</label>
                  <input type="number" step="0.01" min="0" value={customForm.price} onChange={e => setCustomForm(p => ({ ...p, price: e.target.value }))} style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Duration (min)</label>
                  <input type="number" min="0" value={customForm.duration} onChange={e => setCustomForm(p => ({ ...p, duration: e.target.value }))} style={inputStyle} placeholder="60" />
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Description</label>
                <textarea value={customForm.description} onChange={e => setCustomForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Describe what's included..." />
              </div>

              <button type="submit" disabled={customSaving}
                style={{ width: '100%', padding: 13, borderRadius: 8, border: 'none', background: customSaving ? 'rgba(229,51,42,0.5)' : '#e5332a', color: '#fff', fontSize: 15, fontWeight: 700, cursor: customSaving ? 'default' : 'pointer' }}>
                {customSaving ? 'Adding...' : '+ Add Custom Service'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* -- EDIT MODAL -- */}
      {showEditModal && editingService && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => { setShowEditModal(false); setEditingService(null); }}>
          <div style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 500 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 24px' }}>Edit  -  {editingService.serviceName}</h2>
            <form onSubmit={handleEditSave}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Service Name *</label>
                <input required value={editForm.serviceName} onChange={e => setEditForm(p => ({ ...p, serviceName: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Category *</label>
                <select required value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle, appearance: 'auto' }}>
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ background: '#1e293b' }}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Price ($)</label>
                  <input type="number" step="0.01" min="0" value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Duration (min)</label>
                  <input type="number" min="0" value={editForm.duration} onChange={e => setEditForm(p => ({ ...p, duration: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              {editError && (
                <div style={{ marginBottom: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 14px', color: '#f87171', fontSize: 13, fontWeight: 600 }}>{editError}</div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={editSaving}
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#e5332a', color: '#fff', fontWeight: 700, cursor: editSaving ? 'default' : 'pointer' }}>
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setShowEditModal(false); setEditingService(null); }}
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete service confirm modal */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}><FaTrash style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Delete Service?</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>This service will be removed from your catalog.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


