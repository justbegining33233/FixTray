'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '../../../contexts/AuthContext';
import { FaArrowLeft, FaClipboardList } from 'react-icons/fa';

interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
  useRequireAuth(['manager']);
  const router = useRouter();
  const searchParams = useSearchParams();
  const workOrderId = searchParams?.get('workOrderId') || '';

  const [estimate, setEstimate] = useState<EstimateData>({
    workOrderId: workOrderId || '',
    lineItems: [],
    subtotal: 0,
    taxRate: 8.25, // Default tax rate
    taxAmount: 0,
    total: 0,
    notes: ''
  });

  const [workOrder, setWorkOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [estimateMsg, setEstimateMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  useEffect(() => {
    if (workOrderId) {
      fetchWorkOrder();
    } else {
      setLoading(false);
    }
  }, [router, workOrderId]);

  const fetchWorkOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workorders/${workOrderId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkOrder(data.workOrder);
      }
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    const newItem: EstimateLineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
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
    if (!workOrderId || estimate.lineItems.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workorders/${workOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          estimate: {
            amount: estimate.total,
            details: estimate.notes,
            status: 'proposed',
            lineItems: estimate.lineItems,
            subtotal: estimate.subtotal,
            taxRate: estimate.taxRate,
            taxAmount: estimate.taxAmount,
            submittedAt: new Date().toISOString()
          }
        }),
      });

      if (response.ok) {
        router.push(`/workorders/${workOrderId}` as Route);
      } else {
        setEstimateMsg({type:'error',text:'Failed to submit estimate'});
      }
    } catch (error) {
      console.error('Error submitting estimate:', error);
      setEstimateMsg({type:'error',text:'Error submitting estimate'});
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/manager/dashboard" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaClipboardList style={{marginRight:4}} /> Estimate Builder</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>
            {workOrder ? `Creating estimate for Work Order #${workOrder.id}` : 'Create detailed work estimates'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        {/* Work Order Info */}
        {workOrder && (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Work Order Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>Customer</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{workOrder.customer?.firstName} {workOrder.customer?.lastName}</div>
              </div>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>Issue</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{workOrder.issueDescription}</div>
              </div>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>Priority</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{workOrder.priority}</div>
              </div>
              <div>
                <div style={{ color: '#9aa3b2', fontSize: 12 }}>Status</div>
                <div style={{ color: '#e5e7eb', fontWeight: 500 }}>{workOrder.status}</div>
              </div>
            </div>
          </div>
        )}

        {/* Estimate Form */}
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Estimate Details</h3>

          {/* Line Items */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600 }}>Line Items</h4>
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
                + Add Item
              </button>
            </div>

            {estimate.lineItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40, border: '2px dashed rgba(156,163,175,0.3)', borderRadius: 8 }}>
                No items added yet. Click "Add Item" to start building your estimate.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {estimate.lineItems.map((item, _index) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 100px 40px', gap: 12, alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                    <input
                      type="text"
                      placeholder="Description"
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
                      placeholder="Qty"
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
                      placeholder="Unit Price"
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
                      ${item.total.toFixed(2)}
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
            <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Tax Settings</h4>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div>
                <label style={{ color: '#9aa3b2', fontSize: 14, display: 'block', marginBottom: 4 }}>Tax Rate (%)</label>
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
            <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Notes</h4>
            <textarea
              placeholder="Additional notes for the customer..."
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
            <h4 style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Estimate Summary</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, maxWidth: 300 }}>
              <div style={{ color: '#9aa3b2' }}>Subtotal:</div>
              <div style={{ color: '#e5e7eb', textAlign: 'right' }}>${estimate.subtotal.toFixed(2)}</div>
              <div style={{ color: '#9aa3b2' }}>Tax ({estimate.taxRate}%):</div>
              <div style={{ color: '#e5e7eb', textAlign: 'right' }}>${estimate.taxAmount.toFixed(2)}</div>
              <div style={{ color: '#e5e7eb', fontWeight: 600, borderTop: '1px solid rgba(156,163,175,0.3)', paddingTop: 8 }}>Total:</div>
              <div style={{ color: '#22c55e', fontWeight: 600, fontSize: 18, textAlign: 'right', borderTop: '1px solid rgba(156,163,175,0.3)', paddingTop: 8 }}>${estimate.total.toFixed(2)}</div>
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
              Cancel
            </button>
            <button
              onClick={submitEstimate}
              disabled={estimate.lineItems.length === 0}
              style={{
                background: estimate.lineItems.length === 0 ? 'rgba(34,197,94,0.5)' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '10px 20px',
                fontSize: 14,
                cursor: estimate.lineItems.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              Submit Estimate
            </button>
          </div>
        </div>
      </div>
      {estimateMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:estimateMsg.type==='success'?'#dcfce7':'#fde8e8',color:estimateMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {estimateMsg.text}
          <button onClick={()=>setEstimateMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}

export default function ManagerEstimates() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ManagerEstimatesContent />
    </Suspense>
  );
}
