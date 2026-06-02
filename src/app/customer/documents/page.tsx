'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaFileAlt } from 'react-icons/fa';

export default function Documents() {
  useRequireAuth(['customer']);
  const [userName, setUserName] = useState('');
  const [documents] = useState<{id: string; type: string; title: string; name: string; shop: string; date: string; size: string; amount?: number}[]>([]);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Invoice': return '#e5332a';
      case 'Estimate': return '#f59e0b';
      case 'Warranty': return '#22c55e';
      case 'Receipt': return '#a855f7';
      case 'Report': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Documents</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <span style={{fontSize:14, color:'#9aa3b2'}}>Welcome, {userName}</span>
          <button onClick={handleSignOut} style={{padding:'8px 16px', background:'#e5332a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600}}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32}}>
          <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb'}}>My Documents</h1>
          <button style={{
            padding:'12px 24px',
            background:'#e5332a',
            color:'white',
            border:'none',
            borderRadius:8,
            fontSize:16,
            fontWeight:600,
            cursor:'pointer'
          }}>
            Upload Document
          </button>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {documents.map(document => (
            <div key={document.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                    <span style={{fontSize:20}}><FaFileAlt style={{marginRight:4}} /></span>
                    <div>
                      <h3 style={{fontSize:16, fontWeight:700, color:'#e5e7eb', margin:0}}>{document.name}</h3>
                      <div style={{fontSize:14, color:'#9aa3b2', marginTop:4}}>{document.shop}</div>
                    </div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:16}}>
                    <span style={{
                      padding:'4px 8px',
                      background:`rgba(${getTypeColor(document.type) === '#e5332a' ? '229,51,42' : getTypeColor(document.type) === '#f59e0b' ? '245,158,11' : getTypeColor(document.type) === '#22c55e' ? '34,197,94' : getTypeColor(document.type) === '#a855f7' ? '168,85,247' : '239,68,68'},0.2)`,
                      color:getTypeColor(document.type),
                      borderRadius:6,
                      fontSize:12,
                      fontWeight:600
                    }}>
                      {document.type}
                    </span>
                    <span style={{fontSize:14, color:'#9aa3b2'}}>{document.date}</span>
                    <span style={{fontSize:14, color:'#9aa3b2'}}>{document.size}</span>
                  </div>
                </div>
                <div style={{display:'flex', gap:12}}>
                  <button style={{
                    padding:'8px 16px',
                    background:'#e5332a',
                    color:'white',
                    border:'none',
                    borderRadius:6,
                    fontSize:14,
                    fontWeight:600,
                    cursor:'pointer'
                  }}>
                    View
                  </button>
                  <button style={{
                    padding:'8px 16px',
                    background:'rgba(34,197,94,0.1)',
                    color:'#22c55e',
                    border:'1px solid rgba(34,197,94,0.3)',
                    borderRadius:6,
                    fontSize:14,
                    fontWeight:600,
                    cursor:'pointer'
                  }}>
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {documents.length === 0 && (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
            No documents uploaded yet.
          </div>
        )}

        {/* Back to Dashboard */}
        <div style={{marginTop:32, textAlign:'center'}}>
          <Link href="/customer/dashboard" style={{
            padding:'12px 24px',
            background:'#e5332a',
            color:'white',
            border:'none',
            borderRadius:8,
            fontSize:16,
            fontWeight:600,
            textDecoration:'none',
            cursor:'pointer'
          }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
