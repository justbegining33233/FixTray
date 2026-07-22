'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FleetAccountFormProps {
  fleetAccountId?: string;
  initialData?: {
    companyName: string;
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
    billingAddress?: string;
    taxId?: string;
    netTerms?: number;
    creditLimit?: number;
    notes?: string;
    status?: string;
  };
}

export function FleetAccountForm({ fleetAccountId, initialData }: FleetAccountFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    companyName: initialData?.companyName || '',
    contactName: initialData?.contactName || '',
    contactEmail: initialData?.contactEmail || '',
    contactPhone: initialData?.contactPhone || '',
    billingAddress: initialData?.billingAddress || '',
    taxId: initialData?.taxId || '',
    netTerms: initialData?.netTerms || 30,
    creditLimit: initialData?.creditLimit || 0,
    notes: initialData?.notes || '',
    status: initialData?.status || 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'netTerms' || name === 'creditLimit' ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const shopId = localStorage.getItem('shopId');
      const method = fleetAccountId ? 'PUT' : 'POST';
      const url = fleetAccountId
        ? `/api/fleet-accounts/${fleetAccountId}`
        : `/api/fleet-accounts?shopId=${shopId}`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save fleet account');
      }

      router.push('/shop/fleet');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving fleet account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            placeholder="ABC Fleet Services"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Contact Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Name *
          </label>
          <input
            type="text"
            name="contactName"
            value={formData.contactName}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            placeholder="John Smith"
          />
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Email *
          </label>
          <input
            type="email"
            name="contactEmail"
            value={formData.contactEmail}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            placeholder="john@company.com"
          />
        </div>

        {/* Contact Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Phone
          </label>
          <input
            type="tel"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Net Terms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Net Terms (days)
          </label>
          <input
            type="number"
            name="netTerms"
            value={formData.netTerms}
            onChange={handleChange}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
          />
        </div>

        {/* Credit Limit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credit Limit ($)
          </label>
          <input
            type="number"
            name="creditLimit"
            value={formData.creditLimit}
            onChange={handleChange}
            min="0"
            step="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
          />
        </div>

        {/* Tax ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tax ID
          </label>
          <input
            type="text"
            name="taxId"
            value={formData.taxId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            placeholder="XX-XXXXXXX"
          />
        </div>

        {/* Billing Address */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Billing Address
          </label>
          <input
            type="text"
            name="billingAddress"
            value={formData.billingAddress}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            placeholder="123 Business Ave, City, State 12345"
          />
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            placeholder="Additional notes..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : fleetAccountId ? 'Update Fleet Account' : 'Create Fleet Account'}
        </button>
      </div>
    </form>
  );
}
