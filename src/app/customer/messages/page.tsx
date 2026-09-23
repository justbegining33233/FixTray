'use client';

import { usePhrase } from '@/lib/usePhrase';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';
import CustomerMessagingCard from '@/components/CustomerMessagingCard';

function CustomerMessagesInner() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['customer']);
  const searchParams = useSearchParams();
  const shopId = searchParams?.get('shopId') || undefined;

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
        {say("Loading...")}{' '}</div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>{say("Messages")}</h1>
        <p style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 20 }}>
          {say("Message your shop about active work, appointments, or follow-ups.")}{' '}</p>
        <CustomerMessagingCard header="Shop conversations" initialShopId={shopId} />
      </div>
    </div>
  );
}

export default function CustomerMessagesPage() {
  const say = usePhrase();
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>{say("Loading...")}</div>}>
      <CustomerMessagesInner />
    </Suspense>
  );
}
