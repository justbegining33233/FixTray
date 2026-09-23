"use client";
import { usePhrase } from '@/lib/usePhrase';
import { FaCheck } from 'react-icons/fa';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 99.88,
    description: 'Perfect for small shops just getting started',
    features: ['Up to 2 users', 'Work order management', 'Customer portal', 'Email notifications', '14-day free trial'],
    color: '#3b82f6',
    border: 'rgba(59,130,246,0.4)',
  },
  {
    key: 'growth',
    name: 'Growth',
    price: 249.88,
    description: 'For growing shops that need more capacity',
    features: ['Up to 5 users', 'Everything in Starter', 'Recurring work orders', 'Inventory management', 'Reports & analytics', '14-day free trial'],
    color: '#22c55e',
    border: 'rgba(34,197,94,0.4)',
    recommended: true,
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 499.88,
    description: 'For established shops with full feature needs',
    features: ['Up to 15 users', 'Everything in Growth', 'Advanced analytics', 'Priority support', 'Custom integrations', '14-day free trial'],
    color: '#f59e0b',
    border: 'rgba(245,158,11,0.4)',
  },
];

export default function ShopSubscribePage() {
  const say = usePhrase();
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['shop']);
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState('');
  const [email, setEmail] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    setShopId(localStorage.getItem('shopId') || '');
    setEmail(localStorage.getItem('userEmail') || (user as any)?.email || '');
  }, [user]);

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: selectedPlan, shopId, email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || 'Failed to start checkout. Please try again.');
      }
    } catch {
      setCheckoutError('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb', fontSize: 18 }}>
        {say("Loading...")}{' '}</div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '48px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{say("Step 2 of 2")}</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#f9fafb', marginBottom: 12 }}>{say("Choose Your Plan")}</h1>
          <p style={{ fontSize: 16, color: '#9aa3b2', maxWidth: 480, margin: '0 auto' }}>
            {say("All plans include a 14-day free trial. No credit card charged until your trial ends.")}{' '}</p>
        </div>

        {/* Plan Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.key;
            return (
              <div
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                style={{
                  background: isSelected ? `rgba(${plan.key === 'starter' ? '59,130,246' : plan.key === 'growth' ? '34,197,94' : '245,158,11'},0.1)` : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${isSelected ? plan.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16,
                  padding: 28,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                {plan.recommended && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 999, letterSpacing: 1 }}>
                    {say("MOST POPULAR")}{' '}</div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f9fafb', marginBottom: 6 }}>{say(plan.name)}</div>
                  <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 16 }}>{say(plan.description)}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: plan.color }}>${say(plan.price)}</span>
                    <span style={{ fontSize: 14, color: '#6b7280' }}>/mo</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#cbd5e1' }}>
                      <span style={{ color: plan.color, fontWeight: 700, fontSize: 16 }}><FaCheck style={{marginRight:4}} /></span>
                      {say(f)}
                    </div>
                  ))}
                </div>
                {isSelected && (
                  <div style={{ marginTop: 20, background: plan.color, borderRadius: 8, padding: '8px 0', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'white' }}>
                    {say("Selected")}{' '}<FaCheck style={{marginRight:4}} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{ padding: '16px 48px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}
          >
            {loading ? say("Redirecting to checkout...") : `Start Free Trial  -  ${PLANS.find(p => p.key === selectedPlan)?.name}`}
          </button>
          <div style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>
            {say("14-day free trial · Cancel anytime · No hidden fees")}{' '}</div>
          <button
            onClick={() => router.push('/shop/home')}
            style={{ marginTop: 12, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {say("Skip for now (limited access)")}{' '}</button>
        </div>
      </div>
      {checkoutError && (
        <div style={{position:'fixed',bottom:24,right:24,background:'#fde8e8',color:'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {say(checkoutError)}
          <button onClick={()=>setCheckoutError('')} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </div>
  );
}
