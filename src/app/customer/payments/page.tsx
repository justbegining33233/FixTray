'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaLock } from 'react-icons/fa';

interface Payment {
  id: string;
  status: 'Paid' | 'Pending';
  workOrderStatus: string;
  amount: number;
  serviceCost: number;
  fixtrayFee: number;
  amountPaid: number;
  service: string;
  shop: string;
  shopAddress: string;
  vehicle: string;
  date: string;
  paidAt: string;
  canPay: boolean;
}

interface Summary {
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
}

export default function Payments() {
  useRequireAuth(['customer']);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState('');

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers/payments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPayments(data.payments);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handlePay = async (workOrderId: string) => {
    setPaying(workOrderId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workOrderId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPayError('Could not initiate payment. Please try again.');
        setPaying(null);
      }
    } catch {
      setPayError('Payment error. Please try again.');
      setPaying(null);
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

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/customer/dashboard" style={{ fontSize: 24, fontWeight: 900, color: '#e5332a', textDecoration: 'none' }}>FixTray</Link>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>Customer Portal</div>
            <div style={{ fontSize: 12, color: '#9aa3b2' }}>Payments</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/customer/dashboard" style={{ fontSize: 13, color: '#9aa3b2', textDecoration: 'none' }}>Dashboard</Link>
          <Link href="/customer/recurring-approvals" style={{ fontSize: 13, color: '#9aa3b2', textDecoration: 'none' }}>Pending Services</Link>
          <button onClick={handleSignOut} style={{ padding: '8px 16px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e5e7eb', marginBottom: 32 }}>Payment History</h1>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 32 }}>
          <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Total Paid</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#e5332a' }}>${summary.totalPaid.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{summary.paidCount} transactions</div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Pending</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>${summary.totalPending.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{summary.pendingCount} payments due</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Total Work Orders</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{payments.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>All time</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9aa3b2' }}>Loading payments...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {payments.map((payment) => (
              <div key={payment.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
                      {payment.status === 'Paid' ? `$${payment.amountPaid.toFixed(2)} paid` : `$${payment.amount.toFixed(2)} due`}
                    </div>
                    <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 4 }}>{payment.service}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{payment.shop}  {payment.vehicle}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(payment.date)}</div>
                    {payment.status === 'Pending' && payment.amount > 0 && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        Service ${payment.serviceCost.toFixed(2)} + FixTray fee $5.00
                      </div>
                    )}
                  </div>
                  <span style={{
                    padding: '6px 12px',
                    background: payment.status === 'Paid' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                    color: payment.status === 'Paid' ? '#22c55e' : '#f59e0b',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {payment.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link href={`/customer/workorders/${payment.id}`} style={{
                    padding: '8px 16px',
                    background: '#e5332a',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}>
                    View Work Order
                  </Link>
                  {payment.canPay && (
                    <button
                      onClick={() => handlePay(payment.id)}
                      disabled={paying === payment.id}
                      style={{
                        padding: '8px 16px',
                        background: paying === payment.id ? 'rgba(156,163,175,0.1)' : 'rgba(34,197,94,0.1)',
                        color: paying === payment.id ? '#9ca3af' : '#22c55e',
                        border: paying === payment.id ? '1px solid rgba(156,163,175,0.3)' : '1px solid rgba(34,197,94,0.3)',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: paying === payment.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {paying === payment.id ? 'Redirecting...' : `Pay $${payment.amount.toFixed(2)} Securely`}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {payments.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#9aa3b2' }}>
                No payment history yet. When your shop completes work and adds an estimate, it will appear here.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link href="/customer/dashboard" style={{
            padding: '12px 24px', background: '#e5332a', color: 'white', borderRadius: 8,
            fontSize: 16, fontWeight: 600, textDecoration: 'none',
          }}>
            Back to Dashboard
          </Link>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#9aa3b2' }}>
            <FaLock style={{marginRight:4}} /> Secured by Stripe  PCI DSS Compliant  256-bit SSL Encryption
          </div>
        </div>
      </div>

      {payError && (
        <div style={{position:'fixed',bottom:24,right:24,background:'#fde8e8',color:'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {payError}
          <button onClick={()=>setPayError('')} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}
