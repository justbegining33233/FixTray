'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FaDollarSign, FaPlus } from 'react-icons/fa';
import { usePhrase } from '@/lib/usePhrase';
import { shortWorkOrderLabel } from '@/lib/notificationCopy';
import { workOrderStatusLabel, workOrderStatusTone } from '@/lib/workOrderStatus';
import { money, vehicleLabel } from '@/components/mobile/format';
import '@/components/mobile/phone-mock.css';

type Line = { type: string; description: string; price: number; qty: number };
type Note = { id: string; senderName?: string; sender?: string; body: string; createdAt: string };

function toneClass(status: string): string {
  const tone = workOrderStatusTone(status);
  if (tone.color.includes('f59e0b') || tone.color.includes('fbbf24')) return 'pm-b-amber';
  if (tone.color.includes('22c55e') || tone.color.includes('4ade80')) return 'pm-b-green';
  if (tone.color.includes('a855f7') || tone.color.includes('c084fc')) return 'pm-b-purple';
  return 'pm-b-red';
}

export function WorkOrderPhone({
  wo,
  lineItems,
  messages,
  grandTotal,
  canClose,
  onInvoice,
  onPaid,
  onAddItem,
  invoiceDisabled,
  paidDisabled,
  invoiceLabel,
  paidLabel,
}: {
  wo: any;
  lineItems: Line[];
  messages: Note[];
  grandTotal: number;
  canClose: boolean;
  onInvoice: () => void;
  onPaid: () => void;
  onAddItem: () => void;
  invoiceDisabled: boolean;
  paidDisabled: boolean;
  invoiceLabel: string;
  paidLabel: string;
}) {
  const say = usePhrase();
  const customer = [wo.customer?.firstName, wo.customer?.lastName].filter(Boolean).join(' ') || say('Customer');
  const tech = wo.assignedTo ? `${wo.assignedTo.firstName || ''} ${wo.assignedTo.lastName || ''}`.trim() : say('Unassigned');
  const plate = wo.vehicle?.licensePlate || '—';
  const due = wo.dueDate ? new Date(wo.dueDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const pay = String(wo.paymentStatus || 'unpaid').replace(/-/g, ' ');
  const fields: Array<[string, string]> = [
    [say('Vehicle'), vehicleLabel(wo)],
    [say('Assigned Tech'), tech || say('Unassigned')],
    [say('Bay'), wo.bay != null ? `${say('Bay')} ${wo.bay}` : '—'],
    [say('Due Date'), due],
    [say('License Plate'), plate],
    [say('Payment Status'), pay.replace(/\b\w/g, (c: string) => c.toUpperCase())],
  ];
  return (
    <div className="pm">
      <Link href={'/shop/jobs' as Route} className="pm-back">← {say('Back')}</Link>
      <div className="pm-row">
        <div>
          <h1 className="pm-title">{shortWorkOrderLabel(wo.id)}</h1>
          <div className="pm-sub">{vehicleLabel(wo)} · {customer}</div>
        </div>
        <span className={`pm-badge ${toneClass(wo.status)}`}>{say(workOrderStatusLabel(wo.status))}</span>
      </div>
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Work Order Info')}</h3>
        <div className="pm-g2" style={{ marginTop: 8, rowGap: 6 }}>
          {fields.map(([label, value]) => (
            <div key={label}>
              <div className="pm-sect" style={{ fontSize: 9.5 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{value || '—'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="pm-card" style={{ padding: '4px 12px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
          <h3>{say('Line Items')}</h3>
          <button type="button" className="pm-btn pm-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={onAddItem}>
            <FaPlus size={10} /> {say('Add Line Item')}
          </button>
        </div>
        {lineItems.length === 0 ? <div className="pm-empty">{say('No line items yet.')}</div> : lineItems.map((item, index) => {
          const kind = item.type === 'labor' ? say('Labor') : item.type === 'part' ? say('Part') : say('Misc');
          const tag = item.type === 'labor' ? 'pm-b-purple' : item.type === 'part' ? 'pm-b-green' : 'pm-b-ghost';
          return (
            <div key={index} className="pm-li" style={{ padding: '8px 0' }}>
              <span className={`pm-badge ${tag}`} style={{ width: 46, justifyContent: 'center' }}>{kind}</span>
              <div className="pm-grow">
                <div className="t" style={{ fontSize: 12 }}>{item.description || kind}</div>
                <div className="s">{item.qty} × {money(item.price, 2)}</div>
              </div>
              <b style={{ fontSize: 12.5 }}>{money(item.price * item.qty, 2)}</b>
            </div>
          );
        })}
        <div className="pm-kv" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4, paddingTop: 8 }}>
          <span>{say('Total')}</span>
          <b style={{ fontSize: 15 }}>{money(grandTotal, 2)}</b>
        </div>
      </div>
      {canClose ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="pm-btn pm-btn-primary" style={{ flex: 1 }} disabled={invoiceDisabled} onClick={onInvoice}>
            <FaDollarSign /> {invoiceLabel}
          </button>
          <button type="button" className="pm-btn pm-btn-secondary" disabled={paidDisabled} onClick={onPaid}>{paidLabel}</button>
        </div>
      ) : null}
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Messages')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {messages.length === 0 ? <div className="pm-empty">{say('No messages yet.')}</div> : messages.slice(-4).map((message) => (
            <div key={message.id} className="pm-msg them">
              {message.body}
              <div className="meta">{message.senderName || message.sender || say('Shop')} · {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
