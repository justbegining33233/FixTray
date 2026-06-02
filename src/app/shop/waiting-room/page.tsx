'use client';
import { useState, useEffect, useRef, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { FaBatteryFull, FaCheckCircle, FaExclamationTriangle, FaFlagCheckered, FaHourglassHalf, FaMobileAlt, FaOilCan, FaStar, FaWrench } from 'react-icons/fa';

interface WaitingRoomEntry {
  id: string;
  vehicle: string;
  status: string;
  estimatedCompletion?: string;
  tech?: string;
  message?: string;
}

interface WaitingRoomData {
  shopName?: string;
  currentTime: string;
  orders: WaitingRoomEntry[];
  promos?: string[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: ReactNode }> = {
  pending:     { label: 'Waiting', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: <FaHourglassHalf style={{marginRight:4}} /> },
  in_progress: { label: 'In Progress', color: '#ff6b64', bg: 'rgba(96,165,250,0.15)', icon: <FaWrench style={{marginRight:4}} /> },
  completed:   { label: 'Ready!', color: '#22c55e', bg: 'rgba(34,197,94,0.2)', icon: <FaCheckCircle style={{marginRight:4}} /> },
  on_hold:     { label: 'On Hold', color: '#f97316', bg: 'rgba(249,115,22,0.15)', icon: <FaExclamationTriangle style={{marginRight:4}} /> },
};

const PROMOS = [
  ' Summer Tire Special  -  $15 off any set of 4 tires this month!',
  <><FaOilCan style={{marginRight:4}} /> Oil change + tire rotation package  -  only $59.99!</>,
  <><FaStar style={{marginRight:4}} /> Refer a friend and get $25 off your next service</>,
  <><FaMobileAlt style={{marginRight:4}} /> Text us your VIN for an instant maintenance report</>,
  <><FaBatteryFull style={{marginRight:4}} /> Free battery test with any service this week</>,
];

function WaitingRoomContent() {
  const searchParams = useSearchParams();
  const shopId = searchParams?.get('shopId') || '';
  const [data, setData] = useState<WaitingRoomData | null>(null);
  const [time, setTime] = useState(new Date());
  const [promoIdx, setPromoIdx] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    const r = await fetch(`/api/waiting-room${shopId ? `?shopId=${shopId}` : ''}`);
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60000);
    const timeTick = setInterval(() => setTime(new Date()), 1000);
    const promoTick = setInterval(() => setPromoIdx(p => (p + 1) % PROMOS.length), 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(timeTick);
      clearInterval(promoTick);
    };
  }, [shopId]);

  const completed = data?.orders.filter(o => o.status === 'completed') || [];
  const inProgress = data?.orders.filter(o => o.status === 'in_progress') || [];
  const waiting = data?.orders.filter(o => o.status === 'pending') || [];

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#e5e7eb', fontFamily: '"Inter",system-ui,sans-serif', overflow: 'hidden' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Waiting Room Status Board</h1>
      {/* Header */}
      <div style={{ background: 'rgba(229,51,42,0.9)', padding: '16px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/shop/home" style={{ textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 40, height: 40, background: '#000000', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><FaWrench style={{marginRight:4}} /></div>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>FixTray</div>
          </Link>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>{data?.shopName || 'Service Status'}</div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>Live Vehicle Status Board</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 42, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>{time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      <div style={{ padding: '10px 48px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.35)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#ffb4ad', background: 'rgba(229,51,42,0.18)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 999, padding: '4px 10px' }}>
          Active Bays: {inProgress.length}
        </div>
        <div style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '4px 10px' }}>
          Waiting: {waiting.length}
        </div>
        <div style={{ fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 999, padding: '4px 10px' }}>
          Ready: {completed.length}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ padding: '32px 48px', display: 'grid', gridTemplateColumns: completed.length > 0 ? '2fr 1fr' : '1fr', gap: 32 }}>
        {/* Vehicle Status */}
        <div>
          {data?.orders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0', opacity: 0.5 }}>
              <div style={{ fontSize: 60 }}><FaFlagCheckered style={{marginRight:4}} /></div>
              <div style={{ fontSize: 20, marginTop: 16 }}>All vehicles up to date</div>
            </div>
          )}

          {inProgress.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ff6b64', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}><FaWrench style={{marginRight:4}} /> Currently Working On</div>
              {inProgress.map(o => <StatusCard key={o.id} order={o} />)}
            </div>
          )}

          {waiting.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}><FaHourglassHalf style={{marginRight:4}} /> Waiting for Service</div>
              {waiting.map(o => <StatusCard key={o.id} order={o} />)}
            </div>
          )}
        </div>

        {/* Ready / Completed column */}
        {completed.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}><FaCheckCircle style={{marginRight:4}} /> Ready for Pickup!</div>
            {completed.map(o => (
              <div key={o.id} className="animate-pulse" style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e', borderRadius: 14, padding: '16px 20px', marginBottom: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{o.vehicle}</div>
                <div style={{ fontSize: 28, marginTop: 8 }}><FaCheckCircle style={{marginRight:4}} /> <span style={{ color: '#22c55e', fontWeight: 800 }}>READY!</span></div>
                {o.message && <div style={{ fontSize: 13, color: '#86efac', marginTop: 8 }}>{o.message}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promo Ticker */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', padding: '14px 48px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ background: '#e5332a', color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>TODAY&apos;S DEALS</div>
        <div style={{ fontSize: 15, color: '#e5e7eb', opacity: 0.9 }}>
          {data?.promos?.[promoIdx] || PROMOS[promoIdx]}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>Updates every 60s</div>
      </div>
    </div>
  );
}

function StatusCard({ order }: { order: WaitingRoomEntry }) {
  const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 14, padding: '14px 20px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{order.vehicle}</div>
        {order.tech && <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Tech: {order.tech}</div>}
        {order.message && <div style={{ fontSize: 13, color: '#d1d5db', marginTop: 4 }}>{order.message}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 22 }}>{s.icon}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.label}</div>
        {order.estimatedCompletion && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Est: {new Date(order.estimatedCompletion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading waiting room...</div>}>
      <WaitingRoomContent />
    </Suspense>
  );
}


