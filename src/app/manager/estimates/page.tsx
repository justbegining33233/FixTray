'use client';

import { usePhrase } from '@/lib/usePhrase';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '../../../contexts/AuthContext';
import { unwrapWorkOrders } from '@/lib/workOrderList';
import { workOrderTitle } from '@/lib/workOrderMetrics';
import { buildEstimateSave } from '@/lib/estimateAuthorization';
import { formatEstimateMoney } from '@/lib/estimateMoney';
import { FaArrowLeft, FaClipboardList } from 'react-icons/fa';

interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  kind: 'part' | 'labor';
}

interface EstimateData {
  workOrderId: string;
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string;
}

function ManagerEstimatesContent() {
  const say = usePhrase();
  useRequireAuth(['manager']);
  const router = useRouter();
  const searchParams = useSearchParams();
  const workOrderId = searchParams?.get('workOrderId') || '';

  const [estimate, setEstimate] = useState<EstimateData>({
    workOrderId: workOrderId || '',
    lineItems: [] as EstimateLineItem[],
    subtotal: 0,
    taxRate: 8.25, // Default tax rate
    taxAmount: 0,
    total: 0,
    notes: ''
  });

  const [workOrder, setWorkOrder] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(workOrderId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [estimateMsg, setEstimateMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  useEffect(() => {
    fetchTargetingData();
  }, [workOrderId]);

  const fetchTargetingData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const listRes = await fetch('/api/workorders?limit=100', { headers });
      if (listRes.ok) {
        const listData = await listRes.json();
        const open = unwrapWorkOrders(listData).filter((wo: any) =>
          !['closed', 'cancelled', 'completed'].includes(String(wo.status || ''))
        );
        setWorkOrders(open);

        const preferredId = workOrderId || selectedWorkOrderId || open[0]?.id || '';
        if (preferredId) {
          setSelectedWorkOrderId(preferredId);
          setEstimate((prev) => ({ ...prev, workOrderId: preferredId }));
          const match = open.find((wo: any) => wo.id === preferredId);
          if (match) {
            setWorkOrder(match);
            hydrateEstimate(match);
          }
        }
      }

      if (workOrderId) {
        const response = await fetch(`/api/workorders/${workOrderId}`, { headers });
        if (response.ok) {
          const data = await response.json();
          const loaded = data.workOrder ?? data;
          setWorkOrder(loaded);
          setSelectedWorkOrderId(workOrderId);
          hydrateEstimate(loaded);
        }
      }
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkOrder = async (id: string) => {
    setSelectedWorkOrderId(id);
    setEstimate((prev) => ({ ...prev, workOrderId: id }));
    const existing = workOrders.find((wo) => wo.id === id);
    if (existing) setWorkOrder(existing);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workorders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const loaded = data.workOrder ?? data;
        setWorkOrder(loaded);
        hydrateEstimate(loaded);
      }
    } catch (error) {
      console.error('Error fetching selected work order:', error);
    }
  };

  const hydrateEstimate = (wo: any) => {
    const raw = Array.isArray(wo?.estimate?.lineItems) ? wo.estimate.lineItems : [];
    const lineItems: EstimateLineItem[] = raw.map((item: any, index: number) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return {
        id: `${wo?.id || 'line'}-${index}`,
        description: item.description || '',
        quantity,
        unitPrice,
        total: Number(item.total) || quantity * unitPrice,
        kind: item.kind === 'part' ? 'part' : 'labor',
      };
    });
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = typeof wo?.estimate?.taxRate === 'number' ? wo.estimate.taxRate : 8.25;
    const taxAmount = subtotal * (taxRate / 100);
    setEstimate((prev) => ({
      ...prev,
      workOrderId: wo?.id || prev.workOrderId,
      lineItems,
      notes: wo?.estimate?.notes || '',
      taxRate,
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    }));
  };

  const addLineItem = () => {
    const newItem: EstimateLineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      kind: 'labor',
    };
    setEstimate(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem]
    }));
  };

  const updateLineItem = (id: string, field: keyof EstimateLineItem, value: any) => {
    setEstimate(prev => {
      const updatedItems = prev.lineItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.total = updated.quantity * updated.unitPrice;
          }
          return updated;
        }
        return item;
      });

      const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      const taxAmount = subtotal * (prev.taxRate / 100);
      const total = subtotal + taxAmount;

      return {
        ...prev,
        lineItems: updatedItems,
        subtotal,
        taxAmount,
        total
      };
    });
  };

  const removeLineItem = (id: string) => {
    setEstimate(prev => {
      const updatedItems = prev.lineItems.filter(item => item.id !== id);
      const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      const taxAmount = subtotal * (prev.taxRate / 100);
      const total = subtotal + taxAmount;

      return {
        ...prev,
        lineItems: updatedItems,
        subtotal,
        taxAmount,
        total
      };
    });
  };

  const submitEstimate = async () => {
    const targetId = selectedWorkOrderId || workOrderId;
    if (!targetId) {
      setEstimateMsg({ type: 'error', text: 'Select a work order or customer job before submitting.' });
      return;
    }
    if (estimate.lineItems.length === 0) {
      setEstimateMsg({ type: 'error', text: 'Add at least one line item before submitting.' });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const response = await fetch(`/api/workorders/${targetId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(buildEstimateSave(
          estimate.lineItems.map(({ description, quantity, unitPrice, kind }) => ({
            description,
            quantity,
            unitPrice,
            kind,
          })),
          estimate.taxRate,
          estimate.notes,
        )),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setEstimateMsg({ type: 'error', text: error.error || 'Failed to save estimate' });
        return;
      }

      const submitRes = await fetch(`/api/workorders/${targetId}/submit-estimate`, {
        method: 'POST',
        headers,
      });

      if (submitRes.ok) {
        setEstimateMsg({ type: 'success', text: 'Estimate submitted to the customer.' });
        router.push(`/workorders/${targetId}` as Route);
      } else {
        const error = await submitRes.json().catch(() => ({}));
        setEstimateMsg({ type: 'error', text: error.error || 'Estimate saved but could not notify the customer.' });
      }
    } catch (error) {
      console.error('Error submitting estimate:', error);
      setEstimateMsg({type:'error',text:'Error submitting estimate'});
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>{say("Loading...")}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/manager/dashboard" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaClipboardList style={{marginRight:4}} /> {say("Estimate Builder")}</h1>
          <p style={{ color: '#9aa3b2', fontSize: 14, margin: '4px 0 0' }}>{say("Add parts and labor, then submit. The customer must accept and sign. Submitting does not create a work authorization.")}</p>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>
            {workOrder ? `Creating estimate for Work Order #${workOrder.id}` : say("Select a work order, then submit a quote")}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{say("Target Job")}</h3>
          <label style={{ color: '#9aa3b2', fontSize: 13, display: 'block', marginBottom: 8 }}>{say("Work order / customer")}</label>
          <select
            value={selectedWorkOrderId}
            onChange={(e) => handleSelectWorkOrder(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(156,163,175,0.3)',
              borderRadius: 6,
              padding: '10px 12px',
              color: '#e5e7eb',
              fontSize: 14,
            }}
          >
            <option value="">{say("Select a work order")}</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {say("WO-")}{String(wo.id).slice(0, 8)} — {wo.customer?.firstName || ''} {wo.customer?.lastName || ''} — {say(wo.status)}
              </option>
            ))}
          </select>
          {workOrders.length === 0 && (
            <p style={{ color: '#f59e0b', fontSize: 13, marginTop: 8 }}>
              {say("No open work orders found for this shop. Create or open a job first.")}{' '}</p>
          )}
        </div>

        {/* Work Order Info */}
        {workOrder && (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{say("Work Order Details")}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>{say("Customer")}</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{say(workOrder.customer?.firstName)} {say(workOrder.customer?.lastName)}</div>
              </div>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>{say("Issue")}</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{workOrderTitle(workOrder)}</div>
              </div>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>{say("Priority")}</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{say(workOrder.priority)}</div>
              </div>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>{say("Status")}</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{say(workOrder.status)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Estimate Form */}
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>{say("Estimate Details")}</h3>

          {/* Line Items */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600 }}>{say("Line Items")}</h4>
              <button
                onClick={addLineItem}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                {say("+ Add Item")}{' '}</button>
            </div>

            {estimate.lineItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40, border: '2px dashed rgba(156,163,175,0.3)', borderRadius: 8 }}>
                {say("No items added yet. Click \"Add Item\" to start building your estimate.")}{' '}</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {estimate.lineItems.map((item, _index) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 110px 90px 40px', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                    <select
                      aria-label={say("Line type")}
                      value={item.kind}
                      onChange={(e) => updateLineItem(item.id, 'kind', e.target.value === 'part' ? 'part' : 'labor')}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(156,163,175,0.3)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        color: '#e5e7eb',
                        fontSize: 14,
                      }}
                    >
                      <option value="labor">{say("Labor")}</option>
                      <option value="part">{say("Part")}</option>
                    </select>
                    <input
                      type="text"
                      placeholder={say("Description")}
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(156,163,175,0.3)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        color: '#e5e7eb',
                        fontSize: 14
                      }}
                    />
                    <input
                      type="number"
                      placeholder={say("Qty")}
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(156,163,175,0.3)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        color: '#e5e7eb',
                        fontSize: 14,
                        textAlign: 'center'
                      }}
                    />
                    <input
                      type="number"
                      placeholder={say("Unit Price")}
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(156,163,175,0.3)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        color: '#e5e7eb',
                        fontSize: 14,
                        textAlign: 'center'
                      }}
                    />
                    <div style={{ color: '#22c55e', fontWeight: 600, textAlign: 'right' }}>
                      {formatEstimateMoney(item.total)}
                    </div>
                    <button
                      onClick={() => removeLineItem(item.id)}
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax Settings */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{say("Tax Settings")}</h4>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div>
                <label style={{ color: '#9aa3b2', fontSize: 14, display: 'block', marginBottom: 4 }}>{say("Tax Rate (%)")}</label>
                <input
                  type="number"
                  value={estimate.taxRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    const taxAmount = estimate.subtotal * (rate / 100);
                    const total = estimate.subtotal + taxAmount;
                    setEstimate(prev => ({ ...prev, taxRate: rate, taxAmount, total }));
                  }}
                  min="0"
                  step="0.01"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(156,163,175,0.3)',
                    borderRadius: 4,
                    padding: '8px 12px',
                    color: '#e5e7eb',
                    fontSize: 14,
                    width: 100
                  }}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{say("Notes")}</h4>
            <textarea
              placeholder={say("Additional notes for the customer...")}
              value={estimate.notes}
              onChange={(e) => setEstimate(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(156,163,175,0.3)',
                borderRadius: 4,
                padding: '12px',
                color: '#e5e7eb',
                fontSize: 14,
                width: '100%',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Summary */}
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{say("Estimate Summary")}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, maxWidth: 300 }}>
              <div style={{ color: '#9aa3b2' }}>{say("Subtotal:")}</div>
              <div style={{ color: '#e5e7eb', textAlign: 'right' }}>{formatEstimateMoney(estimate.subtotal)}</div>
              <div style={{ color: '#9aa3b2' }}>{say("Tax (")}{say(estimate.taxRate)}%):</div>
              <div style={{ color: '#e5e7eb', textAlign: 'right' }}>{formatEstimateMoney(estimate.taxAmount)}</div>
              <div style={{ color: '#e5e7eb', fontWeight: 600, borderTop: '1px solid rgba(156,163,175,0.3)', paddingTop: 8 }}>{say("Total:")}</div>
              <div style={{ color: '#22c55e', fontWeight: 600, fontSize: 18, textAlign: 'right', borderTop: '1px solid rgba(156,163,175,0.3)', paddingTop: 8 }}>{formatEstimateMoney(estimate.total)}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => router.back()}
              style={{
                background: 'rgba(156,163,175,0.2)',
                color: '#9aa3b2',
                border: '1px solid rgba(156,163,175,0.3)',
                borderRadius: 6,
                padding: '10px 20px',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              {say("Cancel")}{' '}</button>
            <button
              onClick={submitEstimate}
              disabled={estimate.lineItems.length === 0 || submitting || !selectedWorkOrderId}
              style={{
                background: estimate.lineItems.length === 0 || !selectedWorkOrderId ? 'rgba(34,197,94,0.5)' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '10px 20px',
                fontSize: 14,
                cursor: estimate.lineItems.length === 0 || submitting || !selectedWorkOrderId ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              {submitting ? say("Submitting…") : say("Submit Estimate")}
            </button>
          </div>
        </div>
      </div>
      {estimateMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:estimateMsg.type==='success'?'#dcfce7':'#fde8e8',color:estimateMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {say(estimateMsg.text)}
          <button onClick={()=>setEstimateMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}

export default function ManagerEstimates() {
  const say = usePhrase();
  return (
    <Suspense fallback={<div>{say("Loading...")}</div>}>
      <ManagerEstimatesContent />
    </Suspense>
  );
}
