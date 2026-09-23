'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { unwrapTeam } from '@/lib/workOrderList';

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
  const say = usePhrase();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loadedTechs, setLoadedTechs] = useState<Array<{ id: string; name: string }>>([]);
  const technicianOptions = techs.length > 0 ? techs : loadedTechs;

  useEffect(() => {
    if (techs.length > 0) return;
    const token = localStorage.getItem('token');
    fetch('/api/shop/team', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setLoadedTechs(unwrapTeam(data).map((member) => ({
          id: String(member.id),
          name: member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Technician',
        })));
      })
      .catch(() => {});
  }, [techs.length]);

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

      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          date: new Date(`${formData.date}T00:00:00`).toISOString(),
        }),
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
      {error && <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">{say(error)}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{say("Date")}</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">{say("Start Time")}</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">{say("End Time")}</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-2">{say("Technician")}</label>
        <select
          name="techId"
          value={formData.techId}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">{say("Select a technician...")}</option>
          {technicianOptions.map(tech => (
            <option key={tech.id} value={tech.id}>
              {say(tech.name)}
            </option>
          ))}
        </select>
      </div>

      {shiftId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{say("Status")}</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="scheduled">{say("Scheduled")}</option>
            <option value="in-progress">{say("In Progress")}</option>
            <option value="completed">{say("Completed")}</option>
            <option value="cancelled">{say("Cancelled")}</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{say("Notes")}</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder={say("Add any notes about this shift...")}
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
          {loading ? say("Saving...") : shiftId ? say("Update Shift") : say("Create Shift")}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
        >
          {say("Cancel")}{' '}</button>
      </div>
    </form>
  );
}
