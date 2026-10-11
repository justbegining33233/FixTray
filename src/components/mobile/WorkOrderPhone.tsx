'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FaDollarSign, FaPlus } from 'react-icons/fa';
import { usePhrase } from '@/lib/usePhrase';
import { shortWorkOrderLabel } from '@/lib/notificationCopy';
import { workOrderStatusLabel, workOrderStatusTone } from '@/lib/workOrderStatus';
import { money, vehicleLabel } from '@/components/mobile/format';
import { FIXTRAY_SERVICE_FEE_LABEL } from '@/lib/serviceFeeBill';
import { chatMessageContent } from '@/lib/messageAttachment';
import { useAuth } from '@/contexts/AuthContext';
import TurnByTurnPanel from '@/components/TurnByTurnPanel';
import { normalizeRole } from '@/lib/roleNav';
import '@/components/mobile/phone-mock.css';

type Line = { type: string; description: string; price: number; qty: number };
type Note = { id: string; senderName?: string; sender?: string; body: string; displayBody?: string | null; createdAt: string };

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
  serviceFee,
  customerTotal,
  canClose,
  onInvoice,
  onAddItem,
  onSave,
  saving,
  saveMessage,
  unsavedCount,
  invoiceDisabled,
  invoiceLabel,
  inspectionStatus,
  onStartInspection,
  onSkipInspection,
  inspectionBusy,
  inspectionError,
}: {
  wo: any;
  lineItems: Line[];
  messages: Note[];
  grandTotal: number;
  serviceFee?: number;
  customerTotal?: number;
  canClose: boolean;
  onInvoice: () => void;
  onAddItem: () => void;
  onSave: () => void;
  saving?: boolean;
  saveMessage?: string;
  unsavedCount?: number;
  invoiceDisabled: boolean;
  invoiceLabel: string;
  inspectionStatus?: string;
  onStartInspection?: () => void;
  onSkipInspection?: () => void;
  inspectionBusy?: boolean;
  inspectionError?: string;
}) {
  const say = usePhrase();
  const { user } = useAuth();
  const actor = normalizeRole(user?.role);
  const backHref = actor === 'manager'
    ? '/manager/assignments'
    : actor === 'tech'
      ? '/tech/jobs?view=active'
      : actor === 'customer'
        ? '/customer/workorders'
        : '/shop/jobs';
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
      <Link href={backHref as Route} className="pm-back">← {say('Back')}</Link>
      <div className="pm-row">
        <div>
          <h1 className="pm-title">{shortWorkOrderLabel(wo.id)}</h1>
          <div className="pm-sub">{vehicleLabel(wo)} · {customer}</div>
        </div>
        <span className={`pm-badge ${toneClass(wo.status)}`}>{say(workOrderStatusLabel(wo.status))}</span>
      </div>
      {(actor === 'tech' || actor === 'manager') ? <TurnByTurnPanel workOrderId={wo.id} /> : null}
      {onStartInspection ? (
        <div className="pm-card" style={{ padding: 12 }}>
          <h3>{say('Inspection')}</h3>
          <p className="pm-sub" style={{ margin: '6px 0 10px' }}>{say('Optional, before the work. Do it or skip it. Skipping does not hold the job and is not a pass or a fail.')}</p>
          {inspectionStatus && inspectionStatus !== 'none' ? (
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{say(inspectionStatus === 'skipped' ? 'Skipped' : inspectionStatus === 'done' ? 'Done' : inspectionStatus)}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pm-btn pm-btn-primary" style={{ flex: 1 }} onClick={onStartInspection}>{say('Start inspection')}</button>
            {onSkipInspection ? (
              <button type="button" className="pm-btn pm-btn-secondary" disabled={inspectionBusy || (inspectionStatus !== 'none' && inspectionStatus !== 'in-progress')} onClick={onSkipInspection}>{say('Skip')}</button>
            ) : null}
          </div>
          {inspectionError ? <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 8 }}>{say(inspectionError)}</div> : null}
        </div>
      ) : null}
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pm-btn pm-btn-ghost pm-btn-sm" onClick={onAddItem}>
              <FaPlus size={10} /> {say('Add Line Item')}
            </button>
            <button type="button" className="pm-btn pm-btn-primary pm-btn-sm" disabled={saving || !unsavedCount} onClick={onSave}>
              {saving ? say('Saving…') : say('Save line items')}
            </button>
          </div>
        </div>
        {saveMessage ? (
          <div role="status" style={{ margin: '8px 0', fontSize: 12, fontWeight: 700, color: saveMessage.toLowerCase().includes('fail') || saveMessage.toLowerCase().includes('not saved') ? '#fca5a5' : '#86efac' }}>
            {say(saveMessage)}
          </div>
        ) : null}
        {unsavedCount ? (
          <div style={{ fontSize: 12, color: '#fde68a', marginBottom: 6 }}>
            {say('New lines stay on this screen until you save them.')}
          </div>
        ) : null}
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
        {typeof serviceFee === 'number' && typeof customerTotal === 'number' ? (
          <>
            <div className="pm-kv">
              <span>{say(FIXTRAY_SERVICE_FEE_LABEL)}</span>
              <b>{money(serviceFee, 2)}</b>
            </div>
            <div className="pm-kv">
              <span>Customer total</span>
              <b style={{ fontSize: 15 }}>{money(customerTotal, 2)}</b>
            </div>
          </>
        ) : null}
      </div>
      {canClose ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="pm-btn pm-btn-primary" style={{ flex: 1 }} disabled={invoiceDisabled} onClick={onInvoice}>
            <FaDollarSign /> {invoiceLabel}
          </button>
        </div>
      ) : null}
      <div className="pm-card" style={{ padding: 12 }}>
        <h3>{say('Messages')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {messages.length === 0 ? <div className="pm-empty">{say('No messages yet.')}</div> : messages.slice(-4).map((message) => (
            <div key={message.id} className="pm-msg them">
              {chatMessageContent({ body: message.displayBody || message.body }).text}
              <div className="meta">{message.senderName || message.sender || say('Shop')} · {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
