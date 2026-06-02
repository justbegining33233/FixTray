'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FaCheckCircle, FaClock, FaExclamationTriangle, FaHourglassHalf, FaLock, FaSmile, FaWrench } from 'react-icons/fa';

interface PaymentLink {
  id: string;
  token: string;
  amount: number;
  description?: string;
  status: string;
  paidAt?: string;
  expiresAt?: string;
  workOrderId?: string;
  customerName?: string;
  customerEmail?: string;
}

export default function CustomerPayPage() {
  const params = useParams();
  const token = params?.token as string;
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
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
    if (!cardNumber || !expiry || !cvv || !name) { setFormError('Please fill in all card fields.'); return; }
    setPaying(true);
    // Simulate Stripe-like payment processing
    await new Promise(r => setTimeout(r, 1800));
    setPaid(true);
    setPaying(false);
  };

  const formatCard = (v: string) => v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
  const formatExpiry = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 2) return clean.slice(0, 2) + '/' + clean.slice(2);
    return clean;
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: 16 }}>Loading payment...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}><FaExclamationTriangle style={{marginRight:4}} /></div>
        <h2 style={{ color: '#f1f5f9', margin: '16px 0 8px' }}>Payment Link Not Found</h2>
        <p style={{ color: '#94a3b8' }}>{error}</p>
      </div>
    </div>
  );

  if (paid) return (
    <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 80 }}><FaSmile style={{marginRight:4}} /></div>
        <h2 style={{ color: '#22c55e', margin: '16px 0 8px', fontSize: 26 }}>Payment Successful!</h2>
        <p style={{ color: '#94a3b8', marginBottom: 8 }}>Thank you for your payment of <strong>${Number(link?.amount).toFixed(2)}</strong>.</p>
        <p style={{ color: '#94a3b8' }}>A receipt has been sent to your email. Thank you for choosing us!</p>
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
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Secure Payment</div>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>FixTray Auto Service</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#22c55e', fontSize: 13 }}><FaLock style={{marginRight:4}} /> SSL Secured</span>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px' }}>
        {isExpired && <div style={{ background: 'rgba(229,51,42,0.12)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 10, padding: 14, marginBottom: 20, color: '#fca5a5', fontWeight: 600 }}><FaClock style={{marginRight:4}} /> This payment link has expired. Please contact the shop.</div>}
        {isAlreadyPaid && <div style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 14, marginBottom: 20, color: '#86efac', fontWeight: 600 }}><FaCheckCircle style={{marginRight:4}} /> This invoice has already been paid. Thank you!</div>}

        {/* Invoice Summary */}
        <div style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#f1f5f9' }}>Invoice Summary</h2>
          {link?.workOrderId && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Work Order: #{link.workOrderId}</div>}
          {link?.description && <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.5, margin: '0 0 16px' }}>{link.description}</p>}
          <div style={{ background: 'linear-gradient(135deg,#e5332a,#c41f16)', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Amount Due</span>
            <span style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>${Number(link?.amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Form */}
        {!isExpired && !isAlreadyPaid && (
          <div style={{ background: 'rgba(10,16,32,0.68)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, color: '#f1f5f9' }}>Card Information</h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 600 }}>Cardholder Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                style={{ width: '100%', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '11px 14px', fontSize: 15, color: '#f1f5f9', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 600 }}>Card Number</label>
              <input value={cardNumber} onChange={e => setCardNumber(formatCard(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19}
                style={{ width: '100%', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '11px 14px', fontSize: 15, color: '#f1f5f9', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box', letterSpacing: '0.05em' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 600 }}>Expiry</label>
                <input value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5}
                  style={{ width: '100%', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '11px 14px', fontSize: 15, color: '#f1f5f9', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 600 }}>CVV</label>
                <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" type="password" maxLength={4}
                  style={{ width: '100%', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '11px 14px', fontSize: 15, color: '#f1f5f9', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {formError && <p style={{color:'#dc2626',fontSize:13,marginBottom:12,fontWeight:600}}>{formError}</p>}
            <button onClick={handlePay} disabled={paying}
              style={{ width: '100%', background: paying ? '#9ca3af' : '#e5332a', color: '#fff', border: 'none', borderRadius: 10, padding: '15px 0', fontSize: 16, fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer' }}>
              {paying ? <><FaHourglassHalf style={{marginRight:4}} /> Processing...</> : `Pay $${Number(link?.amount).toFixed(2)}`}
            </button>

            <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              <FaLock style={{marginRight:4}} /> Your payment is encrypted and secure. We never store your card details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
