'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaBell, FaCar, FaCheckCircle, FaMapMarkerAlt, FaRoad, FaStepForward, FaStore } from 'react-icons/fa';

interface Approval {
  id: string;
  service: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  vehicle: string;
  estimatedCost: number | null;
  serviceLocation: string;
  createdAt: string;
}

export default function RecurringApprovals() {
  useRequireAuth(['customer']);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'confirmed' | 'skipped'>>({});
  const [approvalMsg, setApprovalMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/customers/recurring-approvals', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) setApprovals(d.approvals); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const respond = async (id: string, action: 'confirm' | 'skip') => {
    setActing(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workorders/${id}/respond-recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setDone((prev) => ({ ...prev, [id]: action === 'confirm' ? 'confirmed' : 'skipped' }));
      } else {
        setApprovalMsg({type:'error',text:data.error || 'Something went wrong'});
      }
    } catch {
      setApprovalMsg({type:'error',text:'Request failed. Please try again.'});
    } finally {
      setActing(null);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('token');
    window.location.href = '/auth/login';
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const pending = approvals.filter((a) => !done[a.id]);
  const resolved = approvals.filter((a) => done[a.id]);

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/customer/dashboard" style={{ fontSize: 24, fontWeight: 900, color: '#e5332a', textDecoration: 'none' }}>FixTray</Link>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>Customer Portal</div>
            <div style={{ fontSize: 12, color: '#9aa3b2' }}>Pending Service Confirmations</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/customer/dashboard" style={{ fontSize: 13, color: '#9aa3b2', textDecoration: 'none' }}>Dashboard</Link>
          <Link href="/customer/payments" style={{ fontSize: 13, color: '#9aa3b2', textDecoration: 'none' }}>Payments</Link>
          <button onClick={handleSignOut} style={{ padding: '8px 16px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>
          <FaBell style={{marginRight:4}} /> Services Awaiting Your Approval
        </h1>
        <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          Your shop has scheduled recurring services for you. Review each one  -  <strong style={{ color: '#e5e7eb' }}>no bay is reserved until you confirm.</strong> Skip it if you don&apos;t need it this time.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9aa3b2' }}>Loading...</div>
        ) : pending.length === 0 && resolved.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'rgba(0,0,0,0.2)', borderRadius: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}><FaCheckCircle style={{marginRight:4}} /></div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>All caught up!</div>
            <div style={{ color: '#9aa3b2', fontSize: 14 }}>No pending service confirmations right now.</div>
          </div>
        ) : (
          <>
            {/* Pending items */}
            {pending.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
                {pending.map((approval) => (
                  <div key={approval.id} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(229,51,42,0.25)', borderRadius: 16, padding: 24 }}>
                    {/* Service info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
                          {approval.service.replace(/^\[Recurring\] /, '')}
                        </div>
                        <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 2 }}><FaStore style={{marginRight:4}} /> {approval.shopName}</div>
                        {approval.shopAddress && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}><FaMapMarkerAlt style={{marginRight:4}} /> {approval.shopAddress}</div>
                        )}
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}><FaCar style={{marginRight:4}} /> {approval.vehicle}</div>
                        {approval.serviceLocation === 'roadside' && (
                          <div style={{ fontSize: 12, color: '#f59e0b' }}><FaRoad style={{marginRight:4}} /> Roadside service</div>
                        )}
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Requested {formatDate(approval.createdAt)}</div>
                      </div>
                      {approval.estimatedCost && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#9aa3b2' }}>Estimated</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>${approval.estimatedCost.toFixed(2)}</div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => respond(approval.id, 'confirm')}
                        disabled={acting === approval.id}
                        style={{
                          flex: 1,
                          minWidth: 160,
                          padding: '12px 20px',
                          background: acting === approval.id ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.15)',
                          color: acting === approval.id ? '#6b7280' : '#22c55e',
                          border: '1px solid rgba(34,197,94,0.4)',
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: acting === approval.id ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {acting === approval.id ? 'Processing...' : <><FaCheckCircle style={{marginRight:4}} /> Yes, Schedule Me In</>}
                      </button>
                      <button
                        onClick={() => respond(approval.id, 'skip')}
                        disabled={acting === approval.id}
                        style={{
                          flex: 1,
                          minWidth: 160,
                          padding: '12px 20px',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#9aa3b2',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: acting === approval.id ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <FaStepForward style={{marginRight:4}} /> Skip This Time
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved this session */}
            {resolved.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Handled this session</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {resolved.map((approval) => (
                    <div key={approval.id} style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${done[approval.id] === 'confirmed' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, color: '#9aa3b2' }}>{approval.service.replace(/^\[Recurring\] /, '')}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{approval.shopName}</div>
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        background: done[approval.id] === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                        color: done[approval.id] === 'confirmed' ? '#22c55e' : '#9aa3b2',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {done[approval.id] === 'confirmed' ? <><FaCheckCircle style={{marginRight:4}} /> Scheduled</> : <><FaStepForward style={{marginRight:4}} /> Skipped</>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link href="/customer/dashboard" style={{ padding: '10px 24px', background: '#e5332a', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {approvalMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:approvalMsg.type==='success'?'#dcfce7':'#fde8e8',color:approvalMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {approvalMsg.text}
          <button onClick={()=>setApprovalMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </div>
  );
}
