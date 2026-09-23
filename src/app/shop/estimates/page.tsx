'use client';

import { usePhrase } from '@/lib/usePhrase';
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { FaClipboardList } from 'react-icons/fa';
import { useRequireAuth } from '@/contexts/AuthContext';
import { unwrapWorkOrders } from '@/lib/workOrderList';
import { issueSummary } from '@/lib/waitingRoomBoard';
import { buildEstimateSave } from '@/lib/estimateAuthorization';
import Sidebar from '@/components/Sidebar';
import TopNavBar from '@/components/TopNavBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import MobileLayout from '@/components/MobileLayout';

interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  kind: 'part' | 'labor';
}

interface ShopJob {
  id: string;
  status?: string;
  estimatedCost?: number | null;
  estimate?: {
    lineItems?: Array<{ description?: string; quantity?: number; unitPrice?: number; total?: number; kind?: string }>;
    taxRate?: number;
    notes?: string;
    total?: number;
  } | null;
  issueDescription?: unknown;
  customer?: { firstName?: string; lastName?: string } | null;
}

const CLOSED = new Set(['closed', 'cancelled', 'completed']);

const fieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(156,163,175,0.3)',
  borderRadius: 6,
  padding: '8px 12px',
  color: '#e5e7eb',
  fontSize: 14,
};

function customerName(job: ShopJob): string {
  const name = [job.customer?.firstName, job.customer?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Customer';
}

function quoteAmount(job: ShopJob): number | null {
  if (typeof job.estimatedCost === 'number') return job.estimatedCost;
  if (job.estimate && typeof job.estimate.total === 'number') return job.estimate.total;
  return null;
}

function ShopEstimatesContent() {
  const say = usePhrase();
  useRequireAuth(['shop']);
  const searchParams = useSearchParams();
  const initialWorkOrderId = searchParams?.get('workOrderId') || '';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [jobs, setJobs] = useState<ShopJob[]>([]);
  const [selectedId, setSelectedId] = useState(initialWorkOrderId);
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [taxRate, setTaxRate] = useState(8.25);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const applyEstimate = (job: ShopJob | undefined) => {
    const existing = job?.estimate?.lineItems;
    if (existing && existing.length > 0) {
      setLineItems(existing.map((item, index) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        return {
          id: `${job?.id || 'line'}-${index}`,
          description: item.description || '',
          quantity,
          unitPrice,
          total: Number(item.total) || quantity * unitPrice,
          kind: item.kind === 'part' ? 'part' : 'labor',
        };
      }));
    } else {
      setLineItems([]);
    }
    setTaxRate(typeof job?.estimate?.taxRate === 'number' ? job.estimate.taxRate : 8.25);
    setNotes(job?.estimate?.notes || '');
  };

  const loadJobs = async (preferredId = selectedId) => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/workorders?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setMessage({ type: 'error', text: 'Unable to load this shop’s work orders.' });
      setJobs([]);
      return;
    }
    const data = await response.json();
    const open = unwrapWorkOrders(data).filter((wo) => !CLOSED.has(String(wo.status || ''))) as ShopJob[];
    setJobs(open);
    const nextId = preferredId && open.some((job) => job.id === preferredId) ? preferredId : '';
    setSelectedId(nextId);
    applyEstimate(open.find((job) => job.id === nextId));
  };

  useEffect(() => {
    loadJobs(initialWorkOrderId).finally(() => setLoading(false));
    // Initial load only. Later refreshes go through loadJobs after submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWorkOrderId]);

  const selectJob = (id: string) => {
    setSelectedId(id);
    setMessage(null);
    applyEstimate(jobs.find((job) => job.id === id));
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: `${Date.now()}`, description: '', quantity: 1, unitPrice: 0, total: 0, kind: 'labor' },
    ]);
  };

  const updateLineItem = (id: string, field: keyof EstimateLineItem, value: string) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const next: EstimateLineItem = { ...item };
      if (field === 'description') next.description = value;
      else if (field === 'kind') next.kind = value === 'part' ? 'part' : 'labor';
      else if (field === 'quantity') next.quantity = Number(value) || 0;
      else if (field === 'unitPrice') next.unitPrice = Number(value) || 0;
      next.total = Number(next.quantity) * Number(next.unitPrice);
      return next;
    }));
  };

  const submitEstimate = async () => {
    if (!selectedId) {
      setMessage({ type: 'error', text: 'Select a work order before submitting.' });
      return;
    }
    if (lineItems.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one line item before submitting.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const saveRes = await fetch(`/api/workorders/${selectedId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(buildEstimateSave(
          lineItems.map(({ description, quantity, unitPrice, kind }) => ({
            description,
            quantity,
            unitPrice,
            kind,
          })),
          taxRate,
          notes,
        )),
      });
      if (!saveRes.ok) {
        const error = await saveRes.json().catch(() => ({}));
        setMessage({ type: 'error', text: error.error || 'Failed to save estimate' });
        return;
      }

      const submitRes = await fetch(`/api/workorders/${selectedId}/submit-estimate`, {
        method: 'POST',
        headers,
      });
      if (!submitRes.ok) {
        const error = await submitRes.json().catch(() => ({}));
        setMessage({ type: 'error', text: error.error || 'Estimate saved but could not notify the customer.' });
        return;
      }

      setMessage({ type: 'success', text: 'Estimate submitted to the customer.' });
      await loadJobs(selectedId);
    } catch (error) {
      console.error('Error submitting shop estimate:', error);
      setMessage({ type: 'error', text: 'Error submitting estimate' });
    } finally {
      setSubmitting(false);
    }
  };

  const selected = jobs.find((job) => job.id === selectedId);

  return (
    <MobileLayout
      role="shop"
      showSidebar
      sidebarContent={<Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      topNavContent={
        <>
          <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
          <Breadcrumbs />
        </>
      }
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
          <FaClipboardList style={{ marginRight: 8 }} /> {say("Shop Estimates")}{' '}</h1>
        <p style={{ fontSize: 14, color: '#9aa3b2', margin: 0 }}>
          {say("Add parts and labor, then submit. The customer accepts and signs on My Estimates. Submitting a quote does not create a work authorization.")}{' '}</p>
      </div>

      {loading ? (
        <div style={{ color: '#e5e7eb', padding: 24 }}>{say("Loading work orders...")}</div>
      ) : (
        <>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h2 style={{ color: '#e5e7eb', fontSize: 18, margin: '0 0 12px' }}>{say("Open jobs")}</h2>
            {jobs.length === 0 ? (
              <p style={{ color: '#f59e0b', margin: 0 }}>
                {say("No open work orders for this shop. Create an in-shop or roadside job first.")}{' '}</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {jobs.map((job) => {
                  const amount = quoteAmount(job);
                  const active = job.id === selectedId;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => selectJob(job.id)}
                      style={{
                        textAlign: 'left',
                        background: active ? 'rgba(229,51,42,0.16)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid rgba(229,51,42,0.45)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        color: '#e5e7eb',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <strong>{say("WO-")}{job.id.slice(0, 8)}</strong>
                        <span style={{ color: '#9aa3b2', fontSize: 13 }}>{say(job.status)}</span>
                      </div>
                      <div style={{ fontSize: 14, marginTop: 4 }}>{customerName(job)}</div>
                      <div style={{ fontSize: 13, color: '#9aa3b2', marginTop: 4 }}>
                        {issueSummary(job.issueDescription) || say("Service")}
                      </div>
                      <div style={{ fontSize: 13, color: amount == null ? '#f59e0b' : '#22c55e', marginTop: 6 }}>
                        {amount == null ? say("No estimate yet") : `Estimate $${amount.toFixed(2)}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ color: '#e5e7eb', fontSize: 20, marginTop: 0 }}>
              {selected ? `Estimate for ${customerName(selected)}` : say("Select a job to build an estimate")}
            </h2>
            {selected && (
              <p style={{ color: '#9aa3b2', fontSize: 14 }}>
                {issueSummary(selected.issueDescription) || say("Service")} ·{' '}
                <Link href={`/workorders/${selected.id}` as Route} style={{ color: '#e5332a' }}>{say("Open work order")}</Link>
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#e5e7eb', fontSize: 16, margin: 0 }}>{say("Line items")}</h3>
              <button type="button" onClick={addLineItem} disabled={!selectedId} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: selectedId ? 'pointer' : 'not-allowed' }}>
                {say("+ Add Item")}{' '}</button>
            </div>

            {lineItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 28, border: '2px dashed rgba(156,163,175,0.3)', borderRadius: 8 }}>
                {say("No items yet. Select a job, then add labor or parts.")}{' '}</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {lineItems.map((item) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 120px 90px auto', gap: 8, alignItems: 'center' }}>
                    <select aria-label={say("Line type")} value={item.kind} onChange={(e) => updateLineItem(item.id, 'kind', e.target.value)} style={fieldStyle}>
                      <option value="labor">{say("Labor")}</option>
                      <option value="part">{say("Part")}</option>
                    </select>
                    <input aria-label={say("Description")} value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} placeholder={say("Labor or part description")} style={fieldStyle} />
                    <input aria-label={say("Quantity")} type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)} style={fieldStyle} />
                    <input aria-label={say("Unit price")} type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)} style={fieldStyle} />
                    <div style={{ color: '#22c55e', fontWeight: 700, textAlign: 'right' }}>${item.total.toFixed(2)}</div>
                    <button type="button" onClick={() => setLineItems((prev) => prev.filter((line) => line.id !== item.id))} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 8px', cursor: 'pointer' }}>{say("Remove")}</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, marginTop: 20, alignItems: 'end' }}>
              <label style={{ color: '#9aa3b2', fontSize: 14 }}>
                {say("Tax rate (%)")}{' '}<input aria-label={say("Tax rate")} type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} style={{ ...fieldStyle, display: 'block', width: 100, marginTop: 4 }} />
              </label>
            </div>

            <label style={{ display: 'block', color: '#9aa3b2', fontSize: 14, marginTop: 16 }}>
              {say("Notes")}{' '}<textarea aria-label={say("Estimate notes")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...fieldStyle, display: 'block', width: '100%', marginTop: 4 }} />
            </label>

            <div style={{ marginTop: 16, color: '#e5e7eb' }}>
              <div>{say("Subtotal: $")}{subtotal.toFixed(2)}</div>
              <div>{say("Tax: $")}{taxAmount.toFixed(2)}</div>
              <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 18 }}>{say("Total: $")}{total.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                onClick={submitEstimate}
                disabled={!selectedId || lineItems.length === 0 || submitting}
                style={{
                  background: !selectedId || lineItems.length === 0 ? 'rgba(34,197,94,0.45)' : '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  fontWeight: 700,
                  cursor: !selectedId || lineItems.length === 0 || submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? say("Submitting…") : say("Submit Estimate")}
              </button>
            </div>
          </div>
        </>
      )}

      {message && (
        <div role="status" style={{ position: 'fixed', bottom: 24, right: 24, background: message.type === 'success' ? '#dcfce7' : '#fde8e8', color: message.type === 'success' ? '#166534' : '#991b1b', borderRadius: 10, padding: '12px 20px', zIndex: 9999, fontWeight: 700 }}>
          {say(message.text)}
        </div>
      )}
    </MobileLayout>
  );
}

export default function ShopEstimatesPage() {
  const say = usePhrase();
  return (
    <Suspense fallback={<div style={{ color: '#e5e7eb', padding: 32 }}>{say("Loading estimates...")}</div>}>
      <ShopEstimatesContent />
    </Suspense>
  );
}
