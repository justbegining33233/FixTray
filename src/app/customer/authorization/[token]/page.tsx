'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { FaBan, FaCar, FaCheckCircle, FaClock, FaExclamationTriangle, FaPencilAlt, FaWrench } from 'react-icons/fa';

interface WorkAuthorization {
  id: string;
  token: string;
  status: string;
  workSummary: string;
  estimateTotal?: number;
  expiresAt?: string;
  signatureData?: string;
  signerName?: string;
  signedAt?: string;
  declinedAt?: string;
  workOrder?: { id: string; vehicle?: string; customer?: { name?: string; email?: string } };
}

export default function CustomerAuthorizationPage() {
  const params = useParams();
  const token = params?.token as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [auth, setAuth] = useState<WorkAuthorization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signerName, setSignerName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'signed' | 'declined' | null>(null);
  const [formError, setFormError] = useState('');
  const [declineConfirm, setDeclineConfirm] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/work-authorizations/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject('Not found'))
      .then(data => { setAuth(data); setLoading(false); })
      .catch(() => { setError('Authorization not found or has expired.'); setLoading(false); });
  }, [token]);

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSig(true);
  };

  const clearSig = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  const sign = async () => {
    if (!hasSig) { setFormError('Please sign above.'); return; }
    if (!signerName.trim()) { setFormError('Please enter your full name.'); return; }
    setFormError('');
    const canvas = canvasRef.current!;
    const signatureData = canvas.toDataURL('image/png');
    setSubmitting(true);
    const r = await fetch(`/api/work-authorizations/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'sign', signatureData, signerName }),
    });
    if (r.ok) setResult('signed');
    else setFormError('Failed to submit. Please try again.');
    setSubmitting(false);
  };

  const decline = async () => {
    setDeclineConfirm(false);
    setSubmitting(true);
    const r = await fetch(`/api/work-authorizations/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'decline' }),
    });
    if (r.ok) setResult('declined');
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: 16 }}>Loading authorization...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}><FaExclamationTriangle style={{marginRight:4}} /></div>
        <h2 style={{ color: '#0b1220', margin: '16px 0 8px' }}>Authorization Not Found</h2>
        <p style={{ color: '#6b7280' }}>{error}</p>
      </div>
    </div>
  );

  if (result === 'signed') return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 80 }}><FaCheckCircle style={{marginRight:4}} /></div>
        <h2 style={{ color: '#0b1220', margin: '16px 0 8px', fontSize: 26 }}>Authorization Signed!</h2>
        <p style={{ color: '#6b7280', marginBottom: 8 }}>Thank you, <strong>{signerName}</strong>. Your digital authorization has been received.</p>
        <p style={{ color: '#6b7280' }}>The shop will now proceed with the approved work. You&apos;ll receive updates on the progress.</p>
      </div>
    </div>
  );

  if (result === 'declined') return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 80 }}><FaBan style={{marginRight:4}} /></div>
        <h2 style={{ color: '#0b1220', margin: '16px 0 8px', fontSize: 26 }}>Authorization Declined</h2>
        <p style={{ color: '#6b7280' }}>You have declined this work authorization. The shop has been notified. Please contact them if you have questions.</p>
      </div>
    </div>
  );

  const isExpired = auth?.expiresAt && new Date(auth.expiresAt) < new Date();
  const isAlreadySigned = auth?.status === 'signed';
  const isDeclined = auth?.status === 'declined';

  return (
    <div style={{ minHeight: "100vh", background: '#000000', fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: '#e5332a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}><FaWrench style={{marginRight:4}} /></div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Work Authorization</div>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>FixTray Auto Service</div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>
        {/* Status banners */}
        {isExpired && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 14, marginBottom: 20, color: '#dc2626', fontWeight: 600 }}><FaClock style={{marginRight:4}} /> This authorization has expired. Please contact the shop.</div>}
        {isAlreadySigned && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14, marginBottom: 20, color: '#16a34a', fontWeight: 600 }}><FaCheckCircle style={{marginRight:4}} /> This work has already been authorized by {auth?.signerName}.</div>}
        {isDeclined && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 14, marginBottom: 20, color: '#dc2626', fontWeight: 600 }}><FaBan style={{marginRight:4}} /> This authorization was declined.</div>}

        {/* Work Summary */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, color: '#0b1220' }}>Proposed Work Summary</h2>
          {auth?.workOrder?.vehicle && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#374151' }}>
              <FaCar style={{marginRight:4}} /> <strong>Vehicle:</strong> {auth.workOrder.vehicle}
            </div>
          )}
          <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{auth?.workSummary}</p>
          {auth?.estimateTotal !== undefined && auth.estimateTotal !== null && (
            <div style={{ marginTop: 20, background: 'linear-gradient(135deg,#e5332a,#c41f16)', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Estimated Total</span>
              <span style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>${Number(auth.estimateTotal).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Signature section (only show if pending) */}
        {!isExpired && !isAlreadySigned && !isDeclined && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#0b1220' }}>Your Authorization</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0, marginBottom: 16 }}>By signing below, you authorize the shop to complete the described work at the estimated price. Additional charges require separate approval.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 6, fontWeight: 600 }}>Full Name *</label>
              <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Your full name"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 15, color: '#0b1220', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Signature *</label>
                {hasSig && <button onClick={clearSig} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: 0 }}>Clear</button>}
              </div>
              <canvas ref={canvasRef} width={520} height={140}
                style={{ border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'crosshair', touchAction: 'none', background: '#fafafa', display: 'block', width: '100%', height: 140 }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)}
              />
              {!hasSig && <p style={{ color: '#9ca3af', fontSize: 12, margin: '6px 0 0', textAlign: 'center' }}>Draw your signature above using mouse or touch</p>}
            </div>

            {formError && <p style={{color:'#dc2626',fontSize:13,marginBottom:12,fontWeight:600,padding:'8px 12px',background:'#fef2f2',borderRadius:6,border:'1px solid #fca5a5'}}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={sign} disabled={submitting}
                style={{ flex: 2, background: '#e5332a', color: '#fff', border: 'none', borderRadius: 8, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? 'Submitting...' : <><FaPencilAlt style={{marginRight:4}} /> Authorize Work</>}
              </button>
              <button onClick={() => setDeclineConfirm(true)} disabled={submitting}
                style={{ flex: 1, background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, padding: '13px 0', fontSize: 14, cursor: 'pointer' }}>
                Decline
              </button>
            </div>
            {auth?.expiresAt && (
              <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
                This authorization expires on {new Date(auth.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      {declineConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#fff',borderRadius:12,padding:32,maxWidth:400,width:'90%'}}>
            <h3 style={{margin:'0 0 12px',fontSize:18,color:'#0b1220'}}>Decline Authorization?</h3>
            <p style={{color:'#6b7280',fontSize:14,margin:'0 0 24px'}}>Are you sure you want to decline this work authorization? The shop will be notified.</p>
            <div style={{display:'flex',gap:12}}>
              <button onClick={decline} style={{flex:1,padding:'11px 0',background:'#e5332a',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Yes, Decline</button>
              <button onClick={()=>setDeclineConfirm(false)} style={{flex:1,padding:'11px 0',background:'#f3f4f6',color:'#374151',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
