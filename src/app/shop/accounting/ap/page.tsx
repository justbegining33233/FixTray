'use client';

import { useEffect, useState } from 'react';
import useRequireAuth from '@/lib/useRequireAuth';
import { money, pageStyle } from '@/components/books/drillChrome';

interface BillRow {
  id: string;
  vendor: string;
  billDate: string;
  dueDate: string;
  status: string;
  amountCents: number;
  openCents: number;
  bucket: string;
}

export default function AccountsPayablePage() {
  const { user, isLoading } = useRequireAuth(['shop', 'accountant']);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [error, setError] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCostCents, setUnitCostCents] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');

  const load = () => {
    const token = localStorage.getItem('token');
    fetch('/api/shop/accounting/bills', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error || 'Could not load bills');
          return;
        }
        setBills(body.bills || []);
      })
      .catch(() => setError('Could not load bills'));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const save = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/shop/accounting/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        vendorId,
        qty: Number(qty),
        unitCostCents: Number(unitCostCents),
        inventoryItemId: inventoryItemId || null,
        description: 'Parts',
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error || 'Could not save the bill');
      return;
    }
    setVendorId('');
    setUnitCostCents('');
    load();
  };

  if (isLoading || !user) return null;
  const readOnly = user.role === 'accountant';

  return (
    <div style={pageStyle}>
      <h1 style={{ marginTop: 0 }}>Vendor bills</h1>
      <p style={{ color: '#c4a8a4' }}>Parts bills update inventory and accounts payable. Open balances are never negative.</p>
      {error ? <p>{error}</p> : null}
      {bills.length === 0 ? <p>No vendor bills yet.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#f0b4ae' }}>
              <th>Vendor</th><th>Bill</th><th>Due</th><th>Status</th><th>Amount</th><th>Open</th><th>Age</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>{bill.vendor}</td>
                <td>{bill.billDate.slice(0, 10)}</td>
                <td>{bill.dueDate.slice(0, 10)}</td>
                <td>{bill.status}</td>
                <td>{money(bill.amountCents)}</td>
                <td>{money(bill.openCents)}</td>
                <td>{bill.bucket}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {readOnly ? <p style={{ color: '#c4a8a4' }}>Read only.</p> : (
        <div style={{ marginTop: 24, display: 'grid', gap: 8, maxWidth: 420 }}>
          <h2>Receive a bill</h2>
          <input placeholder="Vendor id" value={vendorId} onChange={(event) => setVendorId(event.target.value)} />
          <input placeholder="Inventory item id (optional)" value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)} />
          <input placeholder="Quantity" value={qty} onChange={(event) => setQty(event.target.value)} />
          <input placeholder="Unit cost cents" value={unitCostCents} onChange={(event) => setUnitCostCents(event.target.value)} />
          <button type="button" onClick={save}>Save bill</button>
        </div>
      )}
    </div>
  );
}
