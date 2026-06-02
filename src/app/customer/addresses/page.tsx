'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
}

const emptyForm = {
  label: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  isDefault: false,
};

export default function CustomerAddressesPage() {
  useRequireAuth(['customer']);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const loadAddresses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers/addresses', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return;
      const data = await res.json();
      setAddresses(data.addresses || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const startEdit = (address: Address) => {
    setEditing(address);
    setForm({
      label: address.label,
      address: address.address,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      isDefault: address.isDefault,
    });
  };

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async () => {
    setMessage('');
    const token = localStorage.getItem('token');
    const url = editing ? `/api/customers/addresses/${editing.id}` : '/api/customers/addresses';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || 'Unable to save address');
      return;
    }

    setMessage(editing ? 'Address updated.' : 'Address added.');
    reset();
    loadAddresses();
  };

  const remove = async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/customers/addresses/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return;
    loadAddresses();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '30px 20px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <Link href="/customer/dashboard" style={{ color: '#ffb4ad', textDecoration: 'none', fontSize: 14 }}>
          Back to Dashboard
        </Link>

        <h1 style={{ color: '#e5e7eb', fontSize: 30, marginTop: 12, marginBottom: 6 }}>Saved Addresses</h1>
        <p style={{ color: '#9aa3b2', marginBottom: 24 }}>Manage pickup/service locations and set a default address for faster work order requests.</p>

        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <h2 style={{ color: '#f1f5f9', marginTop: 0, fontSize: 18 }}>{editing ? 'Edit Address' : 'Add Address'}</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Label (Home, Office, Yard)" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Street address" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
              <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="City" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
              <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="State" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
              <input value={form.zipCode} onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))} placeholder="ZIP" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' }} />
            </div>
            <label style={{ color: '#cbd5e1', fontSize: 13 }}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} style={{ marginRight: 8 }} />
              Set as default address
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} style={{ background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>
                {editing ? 'Update Address' : 'Save Address'}
              </button>
              {editing && (
                <button onClick={reset} style={{ background: 'rgba(255,255,255,0.1)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
          {message && <div style={{ marginTop: 10, color: '#fda4af', fontSize: 13 }}>{message}</div>}
        </div>

        {loading ? (
          <div style={{ color: '#9aa3b2' }}>Loading addresses...</div>
        ) : addresses.length === 0 ? (
          <div style={{ color: '#9aa3b2' }}>No saved addresses yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {addresses.map((address) => (
              <div key={address.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#f8fafc', fontWeight: 700 }}>
                    {address.label} {address.isDefault ? <span style={{ color: '#22c55e', fontSize: 12 }}>(Default)</span> : null}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 13 }}>{address.address}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{address.city}, {address.state} {address.zipCode}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(address)} style={{ background: 'rgba(229,51,42,0.2)', color: '#ffb4ad', border: '1px solid rgba(229,51,42,0.4)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => remove(address.id)} style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

