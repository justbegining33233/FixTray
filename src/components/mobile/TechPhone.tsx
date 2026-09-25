'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { FaBox, FaCamera, FaFileAlt, FaSearch } from 'react-icons/fa';
import { usePhrase } from '@/lib/usePhrase';
import { shortWorkOrderLabel } from '@/lib/notificationCopy';
import { workOrderStatusLabel, workOrderStatusTone } from '@/lib/workOrderStatus';
import { count, firstName } from '@/components/mobile/format';
import TechLiveMap from '@/components/TechLiveMap';
import '@/components/mobile/phone-mock.css';

function toneClass(status: string): string {
  const tone = workOrderStatusTone(status);
  if (tone.color.includes('f59e0b') || tone.color.includes('fbbf24')) return 'pm-b-amber';
  if (tone.color.includes('a855f7') || tone.color.includes('c084fc') || tone.color.includes('60a5fa')) return 'pm-b-purple';
  if (tone.color.includes('22c55e') || tone.color.includes('4ade80')) return 'pm-b-green';
  return 'pm-b-red';
}

export function TechHomePhone({
  name,
  userId,
  openJobs,
  completedToday,
  partsOrdered,
  revenue,
  ready,
  shopName,
  shopCoords,
  shopNote,
  roadCalls,
}: {
  name: string;
  userId: string;
  openJobs: number;
  completedToday: number;
  partsOrdered: number;
  revenue: string;
  ready: boolean;
  shopName: string;
  shopCoords: { latitude: number; longitude: number } | null;
  shopNote: string | null;
  roadCalls: Array<{ id: string; vehicleType?: string; status?: string }>;
}) {
  const say = usePhrase();
  const [clock, setClock] = useState<{ on: boolean; at: string } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/timeclock/status?userId=${encodeURIComponent(userId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setClock({ on: false, at: '' });
          return;
        }
        const at = data.currentEntry?.clockIn
          ? new Date(data.currentEntry.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '';
        setClock({ on: Boolean(data.isClockedIn), at });
      })
      .catch(() => setClock({ on: false, at: '' }));
  }, [userId]);
  const clockLine = !clock
    ? say('Checking clock status...')
    : clock.on
      ? `${say('Clocked in')}: ${clock.at || say('now')}`
      : say('Not clocked in');
  return (
    <div className="pm">
      <div className="pm-row" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="pm-title">{say('Hi')}, {firstName(name)}</h1>
          <div className="pm-sub">{clockLine}</div>
        </div>
        <span className={`pm-badge ${clock?.on ? 'pm-b-green' : 'pm-b-ghost'}`}>● {clock?.on ? say('Clocked In') : say('Off clock')}</span>
      </div>
      <div className="pm-g2">
        <div className="pm-stat pm-t-red"><span className="lbl">{say('My Open Jobs')}</span><span className="val">{count(openJobs)}</span></div>
        <div className="pm-stat pm-t-green"><span className="lbl">{say('Completed Today')}</span><span className="val">{ready ? count(completedToday) : '…'}</span></div>
        <div className="pm-stat pm-t-amber"><span className="lbl">{say('Parts Ordered')}</span><span className="val">{ready ? count(partsOrdered) : '…'}</span></div>
        <div className="pm-stat"><span className="lbl">{say("Today's Revenue")}</span><span className="val" style={{ fontSize: 21 }}>{ready ? (revenue || '$0') : '…'}</span></div>
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3 style={{ marginBottom: 10 }}>{say('Technician tools')}</h3>
        <div className="pm-qa">
          <Link href={'/tech/dvi' as Route}><span className="pm-ico"><FaSearch /></span>{say('DVI Form')}</Link>
          <Link href={'/tech/dtc-lookup' as Route}><span className="pm-ico a"><FaFileAlt /></span>{say('DTC Lookup')}</Link>
          <Link href={'/tech/photos' as Route}><span className="pm-ico p"><FaCamera /></span>{say('Photos')}</Link>
          <Link href={'/tech/inventory' as Route}><span className="pm-ico g"><FaBox /></span>{say('Inventory')}</Link>
        </div>
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>
          {say('Road Call')}
          <Link href={'/tech/new-roadside-job' as Route} className="pm-btn pm-btn-primary" style={{ padding: '5px 10px', fontSize: 11 }}>{say('Create Road Call')}</Link>
        </h3>
        <div style={{ marginTop: 10, height: 118, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', background: '#0b1220', position: 'relative' }}>
          {shopCoords ? (
            <TechLiveMap workOrderId="shop-location" initialLocation={shopCoords} techName={shopName || say('Shop')} />
          ) : (
            <div className="pm-empty" style={{ padding: 12 }}>{shopNote || say('Shop location is not on the map yet.')}</div>
          )}
        </div>
        <div className="pm-sub" style={{ fontSize: 11, marginTop: 6 }}>
          {roadCalls.length === 0
            ? say('No active road calls')
            : roadCalls.slice(0, 3).map((job) => `${shortWorkOrderLabel(job.id)} · ${job.vehicleType || say('Road Call')}`).join(' · ')}
        </div>
      </div>
    </div>
  );
}

export function TechJobsPhone({
  view,
  orders,
  showOffline,
}: {
  view: 'active' | 'history';
  orders: any[];
  showOffline?: boolean;
}) {
  const say = usePhrase();
  return (
    <div className="pm">
      <div>
        <Link href={'/tech/home' as Route} className="pm-back">← {say('Back to Dashboard')}</Link>
        <h1 className="pm-title" style={{ marginTop: 4 }}>{view === 'history' ? say('Job History') : say('Active Jobs')}</h1>
        <div className="pm-sub">{view === 'history' ? say('Completed work assigned to you.') : say('Open work assigned to you.')}</div>
      </div>
      <div className="pm-seg">
        <Link href={'/tech/jobs?view=active' as Route} className={view === 'active' ? 'on' : ''} style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, padding: '6px 4px', borderRadius: 9, color: view === 'active' ? '#ff6b64' : '#94a3b8', background: view === 'active' ? 'rgba(229,51,42,0.15)' : 'transparent', border: view === 'active' ? '1px solid rgba(229,51,42,0.3)' : '1px solid transparent' }}>{say('Active')}</Link>
        <Link href={'/tech/jobs?view=history' as Route} className={view === 'history' ? 'on' : ''} style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, padding: '6px 4px', borderRadius: 9, color: view === 'history' ? '#ff6b64' : '#94a3b8', background: view === 'history' ? 'rgba(229,51,42,0.15)' : 'transparent', border: view === 'history' ? '1px solid rgba(229,51,42,0.3)' : '1px solid transparent' }}>{say('History')}</Link>
      </div>
      {orders.length === 0 ? (
        <div className="pm-card"><div className="pm-empty">{view === 'history' ? say('No completed jobs assigned to you yet.') : say('No open jobs assigned to you yet.')}</div></div>
      ) : orders.map((order) => {
        const service = order.issueDescription?.symptoms || order.issueDescription || order.serviceType || say('Service');
        const place = order.serviceLocation === 'road-call' || order.serviceLocation === 'roadside'
          ? say('Road Call')
          : order.bay ? `${say('Bay')} ${order.bay}` : say('In shop');
        const inProgress = String(order.status || '').toLowerCase() === 'in-progress';
        return (
          <div key={order.id} className="pm-card" style={{ padding: 12 }}>
            <div className="pm-row">
              <div>
                <div className="pm-sect" style={{ fontSize: 10 }}>{shortWorkOrderLabel(order.id)}</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2 }}>{order.vehicleType || say('Vehicle')}</div>
                <div className="pm-sub" style={{ fontSize: 11.5 }}>{say('Service')}: {typeof service === 'string' ? service : say('Service')}</div>
              </div>
              <span className={`pm-badge ${toneClass(order.status)}`}>{say(workOrderStatusLabel(order.status))}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="pm-badge pm-b-ghost">{place}</span>
              <span style={{ flex: 1 }} />
              <Link href={`/workorders/${order.id}` as Route} className="pm-btn pm-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>{say('View')}</Link>
              {inProgress ? (
                <Link href={'/tech/photos' as Route} className="pm-btn pm-btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>{say('Photos')}</Link>
              ) : null}
              {showOffline && view === 'active' ? (
                <>
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('fixtray-prep-download', { detail: { workOrderId: order.id, status: 'en-route', baseStatus: order.status || 'assigned' } }))} className="pm-btn pm-btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>{say('Start / En route')}</button>
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('fixtray-prep-download', { detail: { workOrderId: order.id } }))} className="pm-btn pm-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>{say('Download for offline')}</button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
