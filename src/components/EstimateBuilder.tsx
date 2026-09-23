'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState } from 'react';

interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface EstimateBuilderProps {
  workOrderId: string;
  onSave: (estimate: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export default function EstimateBuilder({ workOrderId, onSave, onCancel, initialData }: EstimateBuilderProps) {
  const say = usePhrase();
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>(
    initialData?.lineItems || [
      { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]
  );
  const [taxRate, setTaxRate] = useState(initialData?.taxRate || 0);
  const [notes, setNotes] = useState(initialData?.notes || '');

  const addLineItem = () => {
    const newId = (Math.max(...lineItems.map(item => parseInt(item.id)), 0) + 1).toString();
    setLineItems([
      ...lineItems,
      { id: newId, description: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof EstimateLineItem, value: any) => {
    setLineItems(
      lineItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          updated.total = updated.quantity * updated.unitPrice;
          return updated;
        }
        return item;
      })
    );
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * (taxRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const estimate = {
      workOrderId,
      lineItems: lineItems.filter(item => item.description.trim() !== ''),
      subtotal: calculateSubtotal(),
      taxRate,
      tax: calculateTax(),
      total: calculateTotal(),
      notes,
      createdAt: new Date().toISOString(),
    };

    onSave(estimate);
  };

  return (
    <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 32, maxWidth: 900, width: '100%' }}>
      <h2 style={{ color: '#fff', marginBottom: 24, fontSize: 24 }}>{say("Build Estimate")}</h2>

      <form onSubmit={handleSubmit}>
        {/* Line Items */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: 12, marginBottom: 12 }}>
            <div style={{ color: '#9aa3b2', fontSize: 13, fontWeight: 600 }}>{say("Description")}</div>
            <div style={{ color: '#9aa3b2', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{say("Qty")}</div>
            <div style={{ color: '#9aa3b2', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{say("Unit Price")}</div>
            <div style={{ color: '#9aa3b2', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{say("Total")}</div>
            <div style={{ width: 40 }}></div>
          </div>

          {lineItems.map((item, _idx) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: 12, marginBottom: 12 }}>
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                placeholder={say("Labor, parts, service...")}
                required
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 14,
                }}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.quantity}
                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                required
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                required
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 14,
                  textAlign: 'right',
                }}
              />
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#22c55e',
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'right',
              }}>
                ${item.total.toFixed(2)}
              </div>
              <button
                type="button"
                onClick={() => removeLineItem(item.id)}
                disabled={lineItems.length === 1}
                style={{
                  background: lineItems.length === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.2)',
                  border: 'none',
                  color: lineItems.length === 1 ? '#6b7280' : '#ef4444',
                  borderRadius: 8,
                  padding: '10px',
                  cursor: lineItems.length === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addLineItem}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px dashed rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              padding: '12px',
              borderRadius: 8,
              width: '100%',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {say("+ Add Line Item")}{' '}</button>
        </div>

        {/* Tax Rate */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ color: '#9aa3b2', display: 'block', marginBottom: 8, fontSize: 13 }}>{say("Tax Rate (%)")}</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            style={{
              width: '200px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '10px 12px',
              color: '#fff',
              fontSize: 14,
            }}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ color: '#9aa3b2', display: 'block', marginBottom: 8, fontSize: 13 }}>{say("Notes (Optional)")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={say("Additional notes or terms...")}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '12px',
              color: '#fff',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Totals */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#9aa3b2' }}>{say("Subtotal:")}</span>
            <span style={{ color: '#e5e7eb', fontWeight: 600 }}>${calculateSubtotal().toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#9aa3b2' }}>{say("Tax (")}{say(taxRate)}%):</span>
            <span style={{ color: '#e5e7eb', fontWeight: 600 }}>${calculateTax().toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{say("Total:")}</span>
              <span style={{ color: '#22c55e', fontSize: 24, fontWeight: 700 }}>${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            style={{
              flex: 1,
              background: '#e5332a',
              color: '#fff',
              border: 'none',
              padding: '14px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {say("Save & Send Estimate")}{' '}</button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.1)',
              color: '#9aa3b2',
              border: 'none',
              padding: '14px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {say("Cancel")}{' '}</button>
        </div>
      </form>
    </div>
  );
}
