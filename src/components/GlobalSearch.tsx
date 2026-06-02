'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { FaCar, FaSearch, FaUser, FaWrench } from 'react-icons/fa';

interface SearchResults {
  customers: Array<{ id: string; firstName: string; lastName: string; email: string; phone: string | null }>;
  workOrders: Array<{ id: string; status: string; vehicleType: string; createdAt: string; customer: { firstName: string; lastName: string } }>;
  vehicles: Array<{ id: string; make: string; model: string; year: number; vin: string | null; licensePlate: string | null; customerId: string; customer: { firstName: string; lastName: string } }>;
  parts: Array<{ id: string; name: string; sku: string | null; type: string; quantity: number; price: number }>;
  laborRates: Array<{ id: string; name: string; category: string; rate: number }>;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
      if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsFocused(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/shop/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setResults(await res.json());
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const navigate = (path: string) => {
    setIsFocused(false);
    setQuery('');
    setResults(null);
    router.push(path as Route);
  };

  const hasResults = results && (
    results.customers.length > 0
    || results.workOrders.length > 0
    || results.vehicles.length > 0
    || results.parts.length > 0
    || results.laborRates.length > 0
  );

  const showResults = isFocused && query.length >= 2;

  return (
    <div ref={ref} style={{ position: 'relative', width: 360, maxWidth: '36vw' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
      }}>
        <FaSearch style={{ color: '#9aa3b2', fontSize: 13, flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search inventory, VIN/plate, work orders, customers, parts, labor"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#e5e7eb',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <kbd style={{ padding: '1px 5px', background: 'rgba(255,255,255,0.08)', borderRadius: 4, fontSize: 10, color: '#6b7280' }}>Ctrl+K</kbd>
      </div>

      {showResults && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          width: '100%',
          background: '#1a1f2e',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          zIndex: 1200,
        }}>
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 8 }}>
          {loading && <div style={{ padding: 16, textAlign: 'center', color: '#9aa3b2', fontSize: 13 }}>Searching...</div>}

          {!loading && query.length >= 2 && !hasResults && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9aa3b2', fontSize: 13 }}>No results found</div>
          )}

          {results && results.customers.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Customers</div>
              {results.customers.map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/shop/customers/${c.id}/crm`)}
                  style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#e5e7eb', fontSize: 14 }}><FaUser style={{marginRight:4}} /> {c.firstName} {c.lastName}</span>
                  <span style={{ color: '#9aa3b2', fontSize: 12 }}>{c.email}</span>
                </div>
              ))}
            </div>
          )}

          {results && results.workOrders.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Work Orders</div>
              {results.workOrders.map(wo => (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/workorders/${wo.id}`)}
                  style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#e5e7eb', fontSize: 14 }}><FaWrench style={{marginRight:4}} /> {wo.id.slice(0, 8)}  -  {wo.customer.firstName} {wo.customer.lastName}</span>
                  <span style={{ color: '#9aa3b2', fontSize: 12 }}>{wo.status}</span>
                </div>
              ))}
            </div>
          )}

          {results && results.vehicles.length > 0 && (
            <div>
              <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Vehicles</div>
              {results.vehicles.map(v => (
                <div
                  key={v.id}
                  onClick={() => navigate(`/shop/customers/${v.customerId}/crm`)}
                  style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#e5e7eb', fontSize: 14 }}><FaCar style={{marginRight:4}} /> {v.year} {v.make} {v.model}</span>
                  <span style={{ color: '#9aa3b2', fontSize: 12 }}>{v.licensePlate || 'No plate'} | VIN: {v.vin || 'N/A'}</span>
                </div>
              ))}
            </div>
          )}

          {results && results.parts.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Inventory / Parts</div>
              {results.parts.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate('/shop/inventory')}
                  style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#e5e7eb', fontSize: 14 }}>{p.name}</span>
                  <span style={{ color: '#9aa3b2', fontSize: 12 }}>SKU: {p.sku || 'N/A'} | Qty: {p.quantity}</span>
                </div>
              ))}
            </div>
          )}

          {results && results.laborRates.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Labor Rates</div>
              {results.laborRates.map(rate => (
                <div
                  key={rate.id}
                  onClick={() => navigate('/shop/services')}
                  style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#e5e7eb', fontSize: 14 }}>{rate.name} ({rate.category})</span>
                  <span style={{ color: '#9aa3b2', fontSize: 12 }}>${rate.rate.toFixed(2)}/hr</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Type at least 2 characters</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Esc to close</span>
        </div>
      </div>
      )}
    </div>
  );
}
