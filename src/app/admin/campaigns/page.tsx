'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  discountType: string;
  discountValue: number;
  active: boolean;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    discountType: 'percentage',
    discountValue: 10,
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const shopId = localStorage.getItem('shopId');
      const response = await fetch(`/api/campaigns?shopId=${shopId}`);
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const shopId = localStorage.getItem('shopId');
      const response = await fetch(`/api/campaigns?shopId=${shopId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create campaign');

      setFormData({
        name: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        discountType: 'percentage',
        discountValue: 10,
      });
      setFormOpen(false);
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating campaign');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;

    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting campaign');
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Marketing Campaigns</h1>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + New Campaign
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>}

      {/* Form */}
      {formOpen && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded"
              />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Discount Type</label>
                <select
                  value={formData.discountType}
                  onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Discount Value {formData.discountType === 'percentage' ? '(%)' : '($)'}
                </label>
                <input
                  type="number"
                  step={formData.discountType === 'percentage' ? 1 : 0.01}
                  value={formData.discountValue}
                  onChange={e => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Create Campaign
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

      {/* Campaigns List */}
      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white rounded-lg">No campaigns yet.</div>
        ) : (
          campaigns.map(campaign => (
            <div key={campaign.id} className="p-4 bg-white rounded-lg shadow border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold">{campaign.name}</h3>
                  {campaign.description && <p className="text-sm text-gray-600">{campaign.description}</p>}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    campaign.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {campaign.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-600">Period</p>
                  <p className="font-semibold">
                    {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Discount</p>
                  <p className="font-semibold">
                    {campaign.discountValue}
                    {campaign.discountType === 'percentage' ? '%' : '$'}
                  </p>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
