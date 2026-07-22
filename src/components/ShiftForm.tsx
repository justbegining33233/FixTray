'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ShiftFormProps {
  shiftId?: string;
  initialData?: {
    date: string;
    startTime: string;
    endTime: string;
    techId: string;
    status?: string;
    notes?: string;
  };
  techs?: Array<{ id: string; name: string }>;
}

export function ShiftForm({ shiftId, initialData, techs = [] }: ShiftFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    startTime: initialData?.startTime || '09:00',
    endTime: initialData?.endTime || '17:00',
    techId: initialData?.techId || '',
    status: initialData?.status || 'scheduled',
    notes: initialData?.notes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate times
      if (formData.startTime >= formData.endTime) {
        throw new Error('Start time must be before end time');
      }

      const shopId = localStorage.getItem('shopId');
      const method = shiftId ? 'PUT' : 'POST';
      const url = shiftId
        ? `/api/shifts/${shiftId}`
        : `/api/shifts?shopId=${shopId}`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save shift');
      }

      router.push('/manager/schedule');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving shift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {error && <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
          <input
            type="time"
            name="startTime"
            value={formData.startTime}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
          <input
            type="time"
            name="endTime"
            value={formData.endTime}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Technician</label>
        <select
          name="techId"
          value={formData.techId}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Select a technician...</option>
          {techs.map(tech => (
            <option key={tech.id} value={tech.id}>
              {tech.name}
            </option>
          ))}
        </select>
      </div>

      {shiftId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add any notes about this shift..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : shiftId ? 'Update Shift' : 'Create Shift'}
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
