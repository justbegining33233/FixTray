'use client';

import { useState, useEffect } from 'react';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

interface RecurringReminder {
  id: string;
  reminderType: string;
  vehicleId: string;
  frequency: string;
  message: string;
  status: string;
  nextReminderDate: string;
  notificationMethod: string[];
}

export default function RecurringRemindersPage() {
  const [reminders, setReminders] = useState<RecurringReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    fetchReminders();
  }, [filter]);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/recurring-reminders?status=${filter}`);
      const data = await res.json();
      setReminders(data);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await fetch(`/api/recurring-reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });
      fetchReminders();
    } catch (error) {
      console.error('Error pausing reminder:', error);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await fetch(`/api/recurring-reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      fetchReminders();
    } catch (error) {
      console.error('Error resuming reminder:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this reminder?')) {
      try {
        await fetch(`/api/recurring-reminders/${id}`, { method: 'DELETE' });
        fetchReminders();
      } catch (error) {
        console.error('Error deleting reminder:', error);
      }
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading reminders...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <h1 className="text-4xl font-bold mb-8">Recurring Reminders</h1>

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-8">
        {['active', 'paused', 'completed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded font-semibold ${
              filter === tab
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Reminders List */}
      <div className="space-y-4">
        {reminders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No reminders found</p>
        ) : (
          reminders.map((reminder) => (
            <div key={reminder.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{reminder.reminderType}</h3>
                  <p className="text-gray-600 mb-4">{reminder.message}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Frequency:</span>
                      <p className="font-semibold">{reminder.frequency}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className={`font-semibold ${
                        reminder.status === 'active'
                          ? 'text-green-600'
                          : reminder.status === 'paused'
                          ? 'text-yellow-600'
                          : 'text-gray-600'
                      }`}>
                        {reminder.status}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Next:</span>
                      <p className="font-semibold">{formatDate(new Date(reminder.nextReminderDate))}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Methods:</span>
                      <p className="font-semibold">{reminder.notificationMethod.join(', ')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {reminder.status === 'active' ? (
                    <button
                      onClick={() => handlePause(reminder.id)}
                      className="px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResume(reminder.id)}
                      className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Resume
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(reminder.id)}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
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
