'use client';

import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import type { Route } from 'next';

/**
 * In-app Forbidden for shop paths that must not hit edge-blocked admin surfaces.
 * This page is a normal 200 response and does not call the restricted APIs.
 */
export default function ShopRestrictedSurface({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  const say = usePhrase();
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#e5e7eb', padding: 24 }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{say("Forbidden")}</h1>
        <p style={{ color: '#9aa3b2', lineHeight: 1.6, marginBottom: 12 }}>{say(title)}</p>
        <p style={{ color: '#9aa3b2', lineHeight: 1.6, marginBottom: 24 }}>
          {detail || say("Shop Settings → Security still has two-factor authentication and active sessions. Platform admin tools stay off this account.")}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href={'/shop/settings?tab=security' as Route}
            style={{ display: 'inline-block', padding: '12px 20px', background: '#e5332a', color: 'white', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}
          >
            {say("Open Security settings")}{' '}</Link>
          <Link
            href={'/shop/home' as Route}
            style={{ display: 'inline-block', padding: '12px 20px', background: 'transparent', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}
          >
            {say("Shop Home")}{' '}</Link>
        </div>
      </div>
    </main>
  );
}
