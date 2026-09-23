'use client';

import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCheckCircle, FaLock } from 'react-icons/fa';

export default function SecuritySettings() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e5e7eb',
        fontSize: '18px'
      }}>
        {say("Loading...")}{' '}</div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaLock style={{marginRight:4}} /> {say("Security Settings")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("Manage security policies and permissions")}</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        <div style={{display:'grid', gap:24}}>
          {/* Authentication Settings */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>{say("Authentication Settings")}</h2>
            <div style={{display:'grid', gap:16}}>
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:14, color:'#e5e7eb', fontWeight:600}}>{say("Two-Factor Authentication")}</div>
                  <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Require 2FA for all admin accounts")}</div>
                </div>
                <input type="checkbox" style={{width:20, height:20, cursor:'pointer'}} />
              </label>
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:14, color:'#e5e7eb', fontWeight:600}}>{say("Session Timeout")}</div>
                  <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Auto logout after 15 minutes of inactivity")}</div>
                </div>
                <input type="checkbox" defaultChecked style={{width:20, height:20, cursor:'pointer'}} />
              </label>
              <div>
                <label style={{display:'block', fontSize:14, color:'#9aa3b2', marginBottom:8}}>{say("Password Minimum Length")}</label>
                <input 
                  type="number" 
                  defaultValue="8"
                  min="6"
                  max="32"
                  style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                />
              </div>
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:14, color:'#e5e7eb', fontWeight:600}}>{say("Password Complexity")}</div>
                  <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Require uppercase, lowercase, numbers, and symbols")}</div>
                </div>
                <input type="checkbox" defaultChecked style={{width:20, height:20, cursor:'pointer'}} />
              </label>
            </div>
          </div>

          {/* Access Control */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>{say("Access Control")}</h2>
            <div style={{display:'grid', gap:16}}>
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:14, color:'#e5e7eb', fontWeight:600}}>{say("IP Whitelist")}</div>
                  <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Restrict admin access to specific IP addresses")}</div>
                </div>
                <input type="checkbox" style={{width:20, height:20, cursor:'pointer'}} />
              </label>
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:14, color:'#e5e7eb', fontWeight:600}}>{say("API Rate Limiting")}</div>
                  <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Limit API requests to prevent abuse")}</div>
                </div>
                <input type="checkbox" defaultChecked style={{width:20, height:20, cursor:'pointer'}} />
              </label>
              <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:14, color:'#e5e7eb', fontWeight:600}}>{say("Audit Logging")}</div>
                  <div style={{fontSize:12, color:'#9aa3b2'}}>{say("Log all admin actions and changes")}</div>
                </div>
                <input type="checkbox" defaultChecked style={{width:20, height:20, cursor:'pointer'}} />
              </label>
            </div>
          </div>

          {/* Security Alerts */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>{say("Security Alerts")}</h2>
            <div style={{display:'grid', gap:12}}>
              <div style={{padding:16, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8}}>
                <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                  <span style={{fontSize:20}}><FaCheckCircle style={{marginRight:4}} /></span>
                  <span style={{fontSize:14, fontWeight:600, color:'#22c55e'}}>{say("All Systems Secure")}</span>
                </div>
                <div style={{fontSize:12, color:'#9aa3b2'}}>{say("No security threats detected")}</div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{display:'flex', justifyContent:'flex-end', gap:12}}>
            <button 
              style={{padding:'12px 24px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
            >
              {say("Cancel")}{' '}</button>
            <button 
              style={{padding:'12px 24px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
            >
              {say("Save Settings")}{' '}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

