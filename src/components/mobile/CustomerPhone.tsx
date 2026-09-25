'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { FaCalendarAlt, FaCar, FaCreditCard, FaFileAlt, FaSearch } from 'react-icons/fa';
import { usePhrase } from '@/lib/usePhrase';
import SignatureCapture from '@/components/SignatureCapture';
import { shortWorkOrderLabel } from '@/lib/notificationCopy';
import { workOrderStatusLabel } from '@/lib/workOrderStatus';
import { count, firstName, money, vehicleLabel } from '@/components/mobile/format';
import '@/components/mobile/phone-mock.css';

const STEPS = ['Received', 'Estimate', 'Approved', 'In progress', 'Ready'];

function stepIndex(status: string): number {
  const value = String(status || '').toLowerCase();
  if (value === 'completed' || value === 'closed' || value === 'paid') return 4;
  if (value === 'in-progress' || value === 'en-route') return 3;
  if (value === 'assigned' || value === 'waiting-for-payment') return 2;
  if (value.includes('estimate') || value === 'waiting-estimate') return 1;
  return 0;
}

export function CustomerDashPhone({
  name,
  activeJobs,
  vehicles,
  points,
  active,
  recent,
}: {
  name: string;
  activeJobs: number;
  vehicles: number;
  points: number;
  active: any | null;
  recent: any[];
}) {
  const say = usePhrase();
  const reached = active ? stepIndex(active.status) : -1;
  return (
    <div className="pm">
      <div>
        <h1 className="pm-title">{say('Hi')}, {firstName(name)}</h1>
        <div className="pm-sub">{say('Your vehicles, active work, and recent visits.')}</div>
      </div>
      <div className="pm-g3">
        <div className="pm-stat pm-t-red"><span className="lbl">{say('Active Jobs')}</span><span className="val">{count(activeJobs)}</span></div>
        <div className="pm-stat"><span className="lbl">{say('Total Vehicles')}</span><span className="val">{count(vehicles)}</span></div>
        <div className="pm-stat pm-t-amber"><span className="lbl">{say('Loyalty Points')}</span><span className="val">{count(points)}</span></div>
      </div>
      <div className="pm-card" style={{ padding: 12, background: 'rgba(17,24,39,0.88)' }}>
        <h3>
          {say('Active Services')}
          {active ? <span className="pm-badge pm-b-red">{say(workOrderStatusLabel(active.status))}</span> : <span className="pm-badge pm-b-ghost">{say('None')}</span>}
        </h3>
        {active ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <div className="pm-ico"><FaCar /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{vehicleLabel(active)}</div>
              <div className="pm-sub" style={{ fontSize: 11 }}>{shortWorkOrderLabel(active.id)}{active.shop?.name ? ` · ${active.shop.name}` : ''}</div>
            </div>
          </div>
        ) : (
          <div className="pm-empty">{say('No active service right now.')}</div>
        )}
        <div className="pm-steps">
          {STEPS.map((label, index) => (
            <div key={label} className={index <= reached ? 'on' : ''}>
              <div className="pm-bar" style={{ margin: 0 }}><i style={{ width: index <= reached ? '100%' : '0%', background: '#e5332a' }} /></div>
              <span>{say(label)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Link href={'/customer/tracking' as Route} className="pm-btn pm-btn-primary" style={{ flex: 1 }}>{say('Live Tracking')}</Link>
          <Link href={'/customer/messages' as Route} className="pm-btn pm-btn-secondary" style={{ flex: 1 }}>{say('Messages')}</Link>
        </div>
      </div>
      <div className="pm-sect">{say('Discover')}</div>
      <div className="pm-qa">
        <Link href={'/customer/findshops' as Route}><span className="pm-ico"><FaSearch /></span>{say('Find Shops')}</Link>
        <Link href={'/customer/appointments' as Route}><span className="pm-ico a"><FaCalendarAlt /></span>{say('Appointments')}</Link>
        <Link href={'/customer/estimates' as Route}><span className="pm-ico p"><FaFileAlt /></span>{say('My Estimates')}</Link>
        <Link href={'/customer/payments' as Route}><span className="pm-ico g"><FaCreditCard /></span>{say('Payments')}</Link>
      </div>
      <div className="pm-card" style={{ padding: '4px 12px' }}>
        <div style={{ paddingTop: 10 }}><h3>{say('Recent')}</h3></div>
        {recent.length === 0 ? <div className="pm-empty">{say('No recent visits yet.')}</div> : recent.slice(0, 4).map((order) => (
          <Link key={order.id} href={`/customer/workorders/${order.id}` as Route} className="pm-li">
            <div className="pm-ico n"><FaFileAlt size={14} /></div>
            <div className="pm-grow">
              <div className="t">{vehicleLabel(order)}</div>
              <div className="s">{shortWorkOrderLabel(order.id)}</div>
            </div>
            <span className="pm-badge pm-b-ghost">{say(workOrderStatusLabel(order.status))}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

type Estimate = {
  id: string;
  status: 'pending' | 'accepted' | 'denied';
  service: string;
  price: number;
  shop: string;
  description: string;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number; kind?: string }>;
  vehicle?: { year?: number; make?: string; model?: string; vehicleType?: string };
};

export function CustomerEstimatesPhone({
  estimates,
  signerName,
  onSignerName,
  onSignature,
  onDecide,
  busyId,
  message,
}: {
  estimates: Estimate[];
  signerName: string;
  onSignerName: (value: string) => void;
  onSignature: (value: string | null) => void;
  onDecide: (id: string, response: 'accepted' | 'denied') => void;
  busyId: string | null;
  message: string | null;
}) {
  const say = usePhrase();
  const [tab, setTab] = useState<'pending' | 'accepted' | 'denied'>('pending');
  const rows = estimates.filter((estimate) => estimate.status === tab);
  const featured = rows[0];
  return (
    <div className="pm">
      <div>
        <Link href={'/customer/dashboard' as Route} className="pm-back">← {say('Back to Dashboard')}</Link>
        <h1 className="pm-title" style={{ marginTop: 4 }}>{say('My Estimates')}</h1>
      </div>
      <div className="pm-seg">
        <button type="button" className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>{say('PENDING REVIEW')}</button>
        <button type="button" className={tab === 'accepted' ? 'on' : ''} onClick={() => setTab('accepted')}>{say('ACTIVE WORK')}</button>
        <button type="button" className={tab === 'denied' ? 'on' : ''} onClick={() => setTab('denied')}>{say('DENIED')}</button>
      </div>
      {message ? <div className="pm-sub">{message}</div> : null}
      {!featured ? (
        <div className="pm-card"><div className="pm-empty">{say('Nothing in this list.')}</div></div>
      ) : (
        <div className="pm-card" style={{ padding: 12, background: 'rgba(17,24,39,0.88)' }}>
          <div className="pm-row">
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>{vehicleLabel({ vehicle: featured.vehicle, vehicleType: featured.vehicle?.vehicleType })}</div>
              <div className="pm-sub" style={{ fontSize: 11 }}>{featured.shop} · {shortWorkOrderLabel(featured.id)}</div>
            </div>
            <span className={`pm-badge ${tab === 'pending' ? 'pm-b-amber' : tab === 'accepted' ? 'pm-b-green' : 'pm-b-ghost'}`}>
              {tab === 'pending' ? say('PENDING REVIEW') : tab === 'accepted' ? say('ACTIVE WORK') : say('DENIED')}
            </span>
          </div>
          <div className="pm-sect" style={{ marginTop: 10 }}>{say('Estimate Breakdown')}</div>
          {(featured.lineItems && featured.lineItems.length > 0) ? featured.lineItems.map((item, index) => {
            const kind = (item.kind || 'misc').toLowerCase();
            const tag = kind === 'labor' ? 'pm-b-purple' : kind === 'part' ? 'pm-b-green' : 'pm-b-ghost';
            return (
              <div key={index} className="pm-kv" style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                  <span className={`pm-badge ${tag}`} style={{ fontSize: 9, padding: '2px 6px' }}>{kind === 'labor' ? say('LABOR') : kind === 'part' ? say('PART') : say('Misc')}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description} · {say('Qty')} {item.quantity}</span>
                </span>
                <b>{money(item.total || item.unitPrice * item.quantity, 2)}</b>
              </div>
            );
          }) : <div className="pm-empty">{featured.description || say('No line items on this estimate yet.')}</div>}
          <div className="pm-kv" style={{ paddingTop: 8 }}><span>{say('Total')}</span><b style={{ fontSize: 17 }}>{money(featured.price, 2)}</b></div>
          {tab === 'pending' ? (
            <>
              <div className="pm-sub" style={{ fontSize: 10.5, marginTop: 6 }}>{say('Accept or deny requires your signature. A verbal go-ahead is not a work authorization.')}</div>
              <input className="pm-input" style={{ marginTop: 8 }} placeholder={say('Full legal name')} value={signerName} onChange={(event) => onSignerName(event.target.value)} />
              <div className="pm-sign" style={{ marginTop: 8 }}>
                <SignatureCapture onChange={onSignature} tone="dark" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" className="pm-btn pm-btn-primary" style={{ flex: 1.4 }} disabled={busyId === featured.id} onClick={() => onDecide(featured.id, 'accepted')}>
                  {busyId === featured.id ? say('Saving...') : say('Accept Estimate')}
                </button>
                <button type="button" className="pm-btn pm-btn-ghost" style={{ flex: 1 }} disabled={busyId === featured.id} onClick={() => onDecide(featured.id, 'denied')}>
                  {say('Deny Estimate')}
                </button>
              </div>
            </>
          ) : null}
          {rows.slice(1).map((estimate) => (
            <div key={estimate.id} className="pm-li">
              <div className="pm-grow">
                <div className="t">{estimate.service}</div>
                <div className="s">{estimate.shop} · {money(estimate.price, 2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
