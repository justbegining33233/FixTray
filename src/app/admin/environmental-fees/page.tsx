'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EnvironmentalFee {
  id: string;
  name: string;
  feeAmount: number;
  unit: string;
  description?: string;
  active: boolean;
  shopName?: string;
}

interface ShopOption {
  id: string;
  name: string;
}

export default function EnvironmentalFeesPage() {
  const say = usePhrase();
  const [fees, setFees] = useState<EnvironmentalFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    feeAmount: 0,
    unit: 'per-job',
    description: '',
  });

  const authHeaders = (json = false): HeadersInit => {
    const token = localStorage.getItem('token');
    return {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    loadFees();
    const token = localStorage.getItem('token');
    fetch('/api/admin/tenants', { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setShops(rows.map((row: { id: string; name?: string }) => ({ id: row.id, name: row.name || row.id })));
      })
      .catch(() => {});
  }, []);

  const loadFees = async (shopId = selectedShopId) => {
    try {
      const query = shopId ? `?shopId=${encodeURIComponent(shopId)}` : '';
      const response = await fetch(`/api/environmental-fees${query}`, { headers: authHeaders(), credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setFees(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading fees');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedShopId) throw new Error('Select a shop before creating a fee');
      const response = await fetch('/api/environmental-fees', {
        method: 'POST',
        headers: authHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ ...formData, shopId: selectedShopId }),
      });

      if (!response.ok) throw new Error('Failed to create fee');

      setFormData({ name: '', feeAmount: 0, unit: 'per-job', description: '' });
      setFormOpen(false);
      loadFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating fee');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(say('Delete this fee?'))) return;

    try {
      const response = await fetch(`/api/environmental-fees/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete');
      loadFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting fee');
    }
  };

  if (loading) return <div className="text-center py-8">{say("Loading...")}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{say("Environmental Fees")}</h1>
        <div className="flex gap-2 items-center">
          <select
            aria-label={say("Shop")}
            value={selectedShopId}
            onChange={(event) => {
              setSelectedShopId(event.target.value);
              loadFees(event.target.value);
            }}
            className="border rounded px-3 py-2"
          >
            <option value="">{say("All shops")}</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>{say(shop.name)}</option>
            ))}
          </select>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {say("+ New Fee")}{' '}</button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{say(error)}</div>}

      {/* Form */}
      {formOpen && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{say("Fee Name")}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{say("Amount ($)")}</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.feeAmount}
                  onChange={e => setFormData({ ...formData, feeAmount: parseFloat(e.target.value) })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{say("Unit")}</label>
              <select
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="fixed">{say("Fixed")}</option>
                <option value="per-job">{say("Per Job")}</option>
                <option value="per-service">{say("Per Service")}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{say("Description")}</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                {say("Create Fee")}{' '}</button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                {say("Cancel")}{' '}</button>
            </div>
          </form>
        </div>
      )}

      {/* Fees List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {fees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{say("No environmental fees configured.")}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">{say("Name")}</th>
                <th className="text-left px-4 py-2 font-semibold">{say("Amount")}</th>
                <th className="text-left px-4 py-2 font-semibold">{say("Unit")}</th>
                <th className="text-left px-4 py-2 font-semibold">{say("Status")}</th>
                <th className="text-right px-4 py-2 font-semibold">{say("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {fees.map(fee => (
                <tr key={fee.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{say(fee.name)}</p>
                    {fee.shopName && <p className="text-sm text-gray-500">{say(fee.shopName)}</p>}
                    {fee.description && <p className="text-sm text-gray-600">{say(fee.description)}</p>}
                  </td>
                  <td className="px-4 py-3">${Number(fee.feeAmount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">{say(fee.unit)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${fee.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {fee.active ? say("Active") : say("Inactive")}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3">
                    <button
                      onClick={() => handleDelete(fee.id)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      {say("Delete")}{' '}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
