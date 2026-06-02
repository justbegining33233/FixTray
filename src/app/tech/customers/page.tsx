'use client';


import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

import { useEffect, useState, useRef } from 'react';
import { FaArrowLeft, FaUsers } from 'react-icons/fa';

export default function TechCustomers() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/workorders?search=${encodeURIComponent(query)}&limit=50`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.workOrders || []);
      } catch (err: any) {
        console.error('Search error', err);
        setError('Failed to search work orders');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query]);

  if (isLoading) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#e5e7eb', fontSize: 18}}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // useRequireAuth handles redirect
  }

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <Link href="/tech/all-tools" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Tools
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaUsers style={{marginRight:4}} /> Customer Portal</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Search customers and work orders</p>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>

          {/* BIG SEARCH */}
          <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:16}}>
            <input
              aria-label="Search work orders"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Way too big search  -  try: WO-4324, tire, brake, John Doe, VIN..."
              style={{flex:1, padding:'14px 18px', borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.02)', color:'#e5e7eb', fontSize:16}}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <button onClick={() => setQuery('')} style={{padding:'10px 14px', borderRadius:10, background:'#e5332a', color:'white', fontWeight:700}}>Clear</button>
          </div>

          {/* Results */}
          <div style={{minHeight:200}}>
            {loading && <div style={{color:'#9aa3b2'}}>Searching...</div>}
            {error && <div style={{color:'#ef4444'}}>{error}</div>}
            {!loading && !error && results.length === 0 && query.trim().length >= 2 && (
              <div style={{color:'#9aa3b2'}}>No work orders matched your search.</div>
            )}

            {!loading && results.length > 0 && (
              <div style={{display:'grid', gap:10, marginTop:8}}>
                {results.map((wo: any) => (
                  <Link key={wo.id} href={`/workorders/${wo.id}`} style={{textDecoration:'none'}}>
                    <div style={{display:'flex', justifyContent:'space-between', padding:12, borderRadius:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)'}}>
                      <div>
                        <div style={{fontWeight:800, color:'#e5e7eb'}}>WO-{wo.id.substring(0,8)} - {wo.status}</div>
                        <div style={{fontSize:13, color:'#9aa3b2'}}>{wo.issueDescription?.symptoms || (wo.vehicleType ? wo.vehicleType : 'No description')}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:13, color:'#9aa3b2'}}>{wo.customer ? `${wo.customer.firstName} ${wo.customer.lastName}` : ''}</div>
                        <div style={{fontSize:12, color:'#9aa3b2'}}>{wo.createdAt ? new Date(wo.createdAt).toLocaleString() : ''}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Fallback card when no active search */}
            {query.trim().length < 2 && (
              <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>Type at least 2 characters to search work orders by ID, issue, vehicle, customer name, or VIN.</div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
