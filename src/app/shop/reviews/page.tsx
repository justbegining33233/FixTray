'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaComments, FaRegStar, FaStar, FaStore } from 'react-icons/fa';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  shopResponse: string | null;
  shopResponseAt: string | null;
  createdAt: string;
  customer: { id: string; firstName: string; lastName: string };
  workOrder: { id: string; vehicleType: string; serviceLocation: string };
}

const STARS = [1, 2, 3, 4, 5];

export default function ShopReviewsPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState('');
  const [filter, setFilter] = useState<'all' | 'replied' | 'unreplied'>('all');
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteResponseConfirmId, setDeleteResponseConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const sid = localStorage.getItem('shopId') || user?.id || '';
    setShopId(sid);
  }, [user]);

  useEffect(() => {
    if (shopId) fetchReviews();
  }, [shopId]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reviews?shopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setReviews(data.reviews || []);
    } catch {}
    finally { setLoading(false); }
  };

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ response: responseText }),
      });
      if (res.ok) {
        await fetchReviews();
        setResponding(null);
        setResponseText('');
        showToast('success', 'Response published!');
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Failed to save response');
      }
    } catch { showToast('error', 'Error saving response'); }
    finally { setSaving(false); }
  };

  const handleDeleteResponse = async (reviewId: string) => {
    setDeleteResponseConfirmId(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { await fetchReviews(); showToast('success', 'Response removed'); }
    } catch { showToast('error', 'Failed to remove response'); }
  };

  const filtered = reviews
    .filter(r => ratingFilter === 'all' || r.rating === ratingFilter)
    .filter(r => {
      if (filter === 'replied') return !!r.shopResponse;
      if (filter === 'unreplied') return !r.shopResponse;
      return true;
    });

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : ' - ';
  const ratingCounts = STARS.map(s => ({ star: s, count: reviews.filter(r => r.rating === s).length }));

  if (isLoading) return <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, background: toast.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff' }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '16px 32px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link href="/shop/home" style={{ color: '#e5332a', fontSize: 22, fontWeight: 900, textDecoration: 'none' }}>FixTray</Link>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}><FaStar style={{marginRight:4}} /> Customer Reviews</h1>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px' }}>
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 24 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>{avgRating}</div>
            <div style={{ color: '#fbbf24', fontSize: 22, marginTop: 4 }}>{Array.from({length: Math.round(Number(avgRating))}, (_, i) => <FaStar key={i} />)}</div>
            <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 8 }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 }}>Rating Breakdown</div>
            {[...ratingCounts].reverse().map(({ star, count }) => (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ color: '#fbbf24', fontSize: 13, width: 20 }}>{star}<FaStar style={{marginRight:4}} /></div>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: '#fbbf24', width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%', transition: 'width 0.3s' }} />
                </div>
                <div style={{ color: '#9aa3b2', fontSize: 12, width: 24, textAlign: 'right' }}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'unreplied', 'replied'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: filter === f ? '#e5332a' : 'rgba(255,255,255,0.08)', color: filter === f ? '#fff' : '#9aa3b2' }}>
              {f === 'all' ? 'All' : f === 'unreplied' ? 'Needs Reply' : 'Replied'}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setRatingFilter('all')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer', background: ratingFilter === 'all' ? '#e5332a' : 'rgba(255,255,255,0.08)', color: ratingFilter === 'all' ? '#fff' : '#9aa3b2' }}>All <FaStar style={{marginRight:4}} /></button>
            {STARS.map(s => (
              <button key={s} onClick={() => setRatingFilter(ratingFilter === s ? 'all' : s)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer', background: ratingFilter === s ? '#fbbf24' : 'rgba(255,255,255,0.08)', color: ratingFilter === s ? '#000' : '#9aa3b2' }}>{s}<FaStar style={{marginRight:4}} /></button>
            ))}
          </div>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading reviews...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}><FaStar style={{marginRight:4}} /></div>
            <div>{reviews.length === 0 ? 'No reviews yet' : 'No reviews match this filter'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map(review => (
              <div key={review.id} style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${review.shopResponse ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: 20 }}>
                {/* Review header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e5e7eb', fontSize: 15 }}>
                      {review.customer.firstName} {review.customer.lastName}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                      {review.workOrder.vehicleType} - {review.workOrder.serviceLocation} - {new Date(review.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: '#fbbf24' }}>
                    {Array.from({length: review.rating}, (_, i) => <FaStar key={i} />)}{Array.from({length: 5 - review.rating}, (_, i) => <FaRegStar key={i} />)}
                  </div>
                </div>

                {/* Review comment */}
                {review.comment && (
                  <div style={{ color: '#d1d5db', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                    "{review.comment}"
                  </div>
                )}

                {/* Shop Response */}
                {review.shopResponse ? (
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>
                      <FaStore style={{marginRight:4}} /> Your Response  -  {review.shopResponseAt ? new Date(review.shopResponseAt).toLocaleDateString() : ''}
                    </div>
                    <div style={{ color: '#d1d5db', fontSize: 14, lineHeight: 1.5 }}>
                      {responding === review.id ? null : review.shopResponse}
                    </div>
                    {responding !== review.id && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => { setResponding(review.id); setResponseText(review.shopResponse || ''); }} style={{ fontSize: 12, color: '#e5332a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                        <button onClick={() => setDeleteResponseConfirmId(review.id)} style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remove</button>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Response form */}
                {responding === review.id ? (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      value={responseText}
                      onChange={e => setResponseText(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Write your response..."
                      style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#e5e7eb', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{responseText.length}/1000</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setResponding(null); setResponseText(''); }} style={{ padding: '7px 14px', background: 'transparent', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => handleRespond(review.id)} disabled={saving || !responseText.trim()} style={{ padding: '7px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                          {saving ? 'Saving...' : 'Publish Response'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : !review.shopResponse ? (
                  <button onClick={() => { setResponding(review.id); setResponseText(''); }} style={{ fontSize: 13, color: '#e5332a', background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}>
                    <FaComments style={{marginRight:4}} /> Reply to this review
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete response confirm modal */}
      {deleteResponseConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}><FaComments style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Remove Response?</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>This will remove your shop response from the review.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteResponseConfirmId(null)} style={{ flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => handleDeleteResponse(deleteResponseConfirmId)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

