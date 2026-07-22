'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EnvironmentalFee {
  id: string;
  name: string;
  feeAmount: number;
  unit: string;
  description?: string;
  active: boolean;
}

export default function EnvironmentalFeesPage() {
  const [fees, setFees] = useState<EnvironmentalFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    feeAmount: 0,
    unit: 'per-job',
    description: '',
  });

  useEffect(() => {
    loadFees();
  }, []);

  const loadFees = async () => {
    try {
      const shopId = localStorage.getItem('shopId');
      const response = await fetch(`/api/environmental-fees?shopId=${shopId}`);
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setFees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading fees');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const shopId = localStorage.getItem('shopId');
      const response = await fetch(`/api/environmental-fees?shopId=${shopId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
    if (!confirm('Delete this fee?')) return;

    try {
      const response = await fetch(`/api/environmental-fees/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      loadFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting fee');
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Environmental Fees</h1>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + New Fee
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>}

      {/* Form */}
      {formOpen && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fee Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount ($)</label>
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
              <label className="block text-sm font-medium mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="fixed">Fixed</option>
                <option value="per-job">Per Job</option>
                <option value="per-service">Per Service</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Create Fee
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fees List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {fees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No environmental fees configured.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Name</th>
                <th className="text-left px-4 py-2 font-semibold">Amount</th>
                <th className="text-left px-4 py-2 font-semibold">Unit</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-right px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fees.map(fee => (
                <tr key={fee.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{fee.name}</p>
                    {fee.description && <p className="text-sm text-gray-600">{fee.description}</p>}
                  </td>
                  <td className="px-4 py-3">${fee.feeAmount.toFixed(2)}</td>
                  <td className="px-4 py-3">{fee.unit}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${fee.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {fee.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3">
                    <button
                      onClick={() => handleDelete(fee.id)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
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
