'use client';
import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FaCheckCircle, FaClock, FaExclamationTriangle, FaLock, FaWrench } from 'react-icons/fa';

interface PaymentLink {
  id: string;
  token: string;
  amount: number;
  serviceCost?: number;
  serviceFee?: number;
  description?: string;
  status: string;
  paidAt?: string;
  expiresAt?: string;
  workOrderId?: string;
  cardPaymentAvailable?: boolean;
  customerName?: string;
  customerEmail?: string;
}

export default function CustomerPayPage() {
  const say = usePhrase();
  const params = useParams();
  const token = params?.token as string;
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/payment-links?token=${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const found = Array.isArray(data) ? data.find((l: PaymentLink) => l.token === token) : data;
        if (!found) throw new Error('Not found');
        setLink(found);
        setLoading(false);
      })
      .catch(() => { setError('Payment link not found or has expired.'); setLoading(false); });
  }, [token]);

  const handlePay = async () => {
    setPaying(true);
    setFormError('');
    try {
      const response = await fetch('/api/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay', token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        setFormError(data.error || 'Checkout could not be started.');
        setPaying(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setFormError('Checkout could not be started.');
      setPaying(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: 16 }}>{say("Loading payment...")}</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}><FaExclamationTriangle style={{marginRight:4}} /></div>
        <h2 style={{ color: '#f1f5f9', margin: '16px 0 8px' }}>{say("Payment Link Not Found")}</h2>
        <p style={{ color: '#94a3b8' }}>{say(error)}</p>
      </div>
    </div>
  );

  const isExpired = link?.expiresAt && new Date(link.expiresAt) < new Date();
  const isAlreadyPaid = link?.status === 'paid';

  return (
    <div style={{ minHeight: "100vh", background: 'transparent', fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: '#e5332a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}><FaWrench style={{marginRight:4}} /></div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{say("Secure Payment")}</div>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>{say("FixTray Auto Service")}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#22c55e', fontSize: 13 }}><FaLock style={{marginRight:4}} /> {say("SSL Secured")}</span>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px' }}>
        {isExpired && <div style={{ background: 'rgba(229,51,42,0.12)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 10, padding: 14, marginBottom: 20, color: '#fca5a5', fontWeight: 600 }}><FaClock style={{marginRight:4}} /> {say("This payment link has expired. Please contact the shop.")}</div>}
        {isAlreadyPaid && <div style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 14, marginBottom: 20, color: '#86efac', fontWeight: 600 }}><FaCheckCircle style={{marginRight:4}} /> {say("This invoice has already been paid. Thank you!")}</div>}

        {/* Invoice Summary */}
        <div style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#f1f5f9' }}>{say("Invoice Summary")}</h2>
          {link?.workOrderId && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{say("Work Order: #")}{say(link.workOrderId)}</div>}
          {link?.description && <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.5, margin: '0 0 16px' }}>{say(link.description)}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#e5e7eb' }}>
              <span>{say("Services & Parts")}</span>
              <span>${Number(link?.serviceCost ?? Math.max(0, Number(link?.amount) - Number(link?.serviceFee || 0))).toFixed(2)}</span>
            </div>
            {Number(link?.serviceFee) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#9aa3b2' }}>
                <span>{say("FixTray Service Fee")}</span>
                <span>${Number(link?.serviceFee).toFixed(2)}</span>
              </div>
            )}
          </div>
          <div style={{ background: 'linear-gradient(135deg,#e5332a,#c41f16)', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{say("Total Due")}</span>
            <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>${Number(link?.amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Form */}
        {!isExpired && !isAlreadyPaid && link?.cardPaymentAvailable === true && (
          <div style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24 }}>
            {formError && <p style={{color:'#dc2626',fontSize:13,marginBottom:12,fontWeight:600}}>{say(formError)}</p>}
            <button onClick={handlePay} disabled={paying}
              style={{ width: '100%', background: paying ? '#9ca3af' : '#e5332a', color: '#fff', border: 'none', borderRadius: 10, padding: '15px 0', fontSize: 16, fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer' }}>
              {paying ? say("Redirecting to Stripe...") : `Pay $${Number(link?.amount).toFixed(2)}`}
            </button>
            <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              <FaLock style={{marginRight:4}} /> {say("Pay opens Stripe Checkout. FixTray does not store your card.")}{' '}</p>
          </div>
        )}
        {!isExpired && !isAlreadyPaid && link?.cardPaymentAvailable !== true && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 14, color: '#fcd34d', fontWeight: 600 }}>
            {say("This shop cannot take card payment yet. The shop still needs to finish Stripe payout setup. Ask the shop, or pay another way.")}
          </div>
        )}
      </div>
    </div>
  );
}
