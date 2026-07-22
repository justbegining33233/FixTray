'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LeaveRequestFormProps {
  leaveRequestId?: string;
  initialData?: {
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
    status?: string;
  };
}

export function LeaveRequestForm({ leaveRequestId, initialData }: LeaveRequestFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate || new Date().toISOString().split('T')[0],
    type: initialData?.type || 'vacation',
    reason: initialData?.reason || '',
    status: initialData?.status || 'pending',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const calculateDays = () => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate dates
      if (formData.startDate > formData.endDate) {
        throw new Error('End date must be after start date');
      }

      const days = calculateDays();
      if (days > 10 && formData.type === 'vacation') {
        throw new Error('Maximum 10 consecutive vacation days allowed');
      }

      const shopId = localStorage.getItem('shopId');
      const method = leaveRequestId ? 'PUT' : 'POST';
      const url = leaveRequestId
        ? `/api/leave-requests/${leaveRequestId}`
        : `/api/leave-requests?shopId=${shopId}`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save leave request');
      }

      router.push('/tech/leave-requests');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving leave request');
    } finally {
      setLoading(false);
    }
  };

  const days = calculateDays();

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {error && <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Leave Type
        </label>
        <select
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="vacation">Vacation</option>
          <option value="sick">Sick Leave</option>
          <option value="personal">Personal Day</option>
          <option value="bereavement">Bereavement</option>
          <option value="parental">Parental Leave</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
        <textarea
          name="reason"
          value={formData.reason}
          onChange={handleChange}
          placeholder="Provide details about your leave request..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
        />
      </div>

      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Total Days:</span> {days} day{days !== 1 ? 's' : ''}
        </p>
        {formData.type === 'vacation' && days > 10 && (
          <p className="text-sm text-red-600 mt-2">
            ⚠️ Vacation requests cannot exceed 10 consecutive days.
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Submitting...' : leaveRequestId ? 'Update Request' : 'Submit Request'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
