'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft } from 'react-icons/fa';

interface InsightDetail {
  id: string;
  metric: string;
  value: string;
  description: string;
  color: string;
  trend: string;
}

interface BreakdownRow {
  id: string;
  service: string;
  shop: string;
  amount: number;
  date: string;
}

export default function InsightDetailPage() {
  const say = usePhrase();
  useRequireAuth(['customer']);
  const params = useParams<{ id: string }>();
  const insightId = String(params?.id || '');
  const [insight, setInsight] = useState<InsightDetail | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [asOf, setAsOf] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/customers/insights', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const match = (data?.insights || []).find((row: InsightDetail) => row.id === insightId);
        if (!match) {
          setMissing(true);
          return;
        }
        setInsight(match);
        setBreakdown(Array.isArray(data.breakdown) ? data.breakdown : []);
        setLoyaltyPoints(typeof data.summary?.loyaltyPoints === 'number' ? data.summary.loyaltyPoints : null);
        setAsOf(Date.now());
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [insightId]);

  const showOrders = insightId === 'total-spent' || insightId === 'last-90-days';
  const rows = insightId === 'last-90-days' && asOf
    ? breakdown.filter((row) => asOf - new Date(row.date).getTime() <= 90 * 24 * 60 * 60 * 1000)
    : breakdown;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 32 }}>
        <Link href="/customer/insights" style={{ color: '#e5332a', textDecoration: 'none', fontWeight: 700 }}>
          <FaArrowLeft style={{ marginRight: 6 }} /> {say("Back to Insights")}{' '}</Link>
        {loading ? <p style={{ marginTop: 32, color: '#9aa3b2' }}>{say("Loading insight...")}</p> : null}
        {!loading && missing ? (
          <div style={{ marginTop: 32, padding: 24, borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
            <h1 style={{ fontSize: 24 }}>{say("Insight not found")}</h1>
            <p style={{ color: '#9aa3b2' }}>{say("That insight is not available for this account.")}</p>
          </div>
        ) : null}
        {insight ? (
          <div style={{ marginTop: 24 }}>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>{say(insight.metric)}</h1>
            <div style={{ fontSize: 36, fontWeight: 800, color: insight.color }}>{say(insight.value)}</div>
            <p style={{ color: '#9aa3b2' }}>{say(insight.trend)}</p>
            <p style={{ lineHeight: 1.6, maxWidth: 640 }}>{say(insight.description)}</p>
            {insightId === 'loyalty-points' ? (
              <p style={{ marginTop: 16 }}>
                {say("Balance used by Rewards:")}{' '}<strong>{loyaltyPoints ?? insight.value}</strong>.{' '}
                <Link href="/customer/rewards" style={{ color: '#e5332a' }}>{say("Open rewards")}</Link>
              </p>
            ) : null}
            {showOrders ? (
              <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                {rows.length === 0 ? <p style={{ color: '#9aa3b2' }}>{say("No completed services in this window.")}</p> : null}
                {rows.map((row) => (
                  <div key={row.id} style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontWeight: 700 }}>{say(row.service)}</div>
                    <div style={{ color: '#9aa3b2', fontSize: 14 }}>{say(row.shop)} · {new Date(row.date).toLocaleDateString()} · ${Number(row.amount).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
