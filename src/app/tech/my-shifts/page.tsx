'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDate, formatDuration } from '@/lib/utils';

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  techId: string;
  shopId: string;
}

interface SwapRequest {
  id: string;
  shiftId: string;
  requestingTechId: string;
  targetTechId: string;
  status: string;
}

export default function MyShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'all'>('upcoming');
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [swapReason, setSwapReason] = useState('');

  const techId = localStorage.getItem('userId') || '';

  useEffect(() => {
    loadShifts();
    loadSwapRequests();
  }, [filter]);

  const loadShifts = async () => {
    try {
      const response = await fetch(`/api/shifts?techId=${techId}&status=${filter}`);
      if (!response.ok) throw new Error('Failed to load shifts');
      const data = await response.json();
      setShifts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading shifts');
    } finally {
      setLoading(false);
    }
  };

  const loadSwapRequests = async () => {
    try {
      const response = await fetch(`/api/shift-swaps?techId=${techId}`);
      if (!response.ok) throw new Error('Failed to load swap requests');
      const data = await response.json();
      setSwapRequests(data);
    } catch (err) {
      console.error('Error loading swap requests:', err);
    }
  };

  const handleRequestSwap = async (shiftId: string, targetTechId: string) => {
    try {
      const response = await fetch('/api/shift-swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId,
          targetTechId,
          reason: swapReason,
        }),
      });

      if (!response.ok) throw new Error('Failed to request swap');
      setShowSwapModal(false);
      setSelectedShift(null);
      setSwapReason('');
      loadSwapRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error requesting swap');
    }
  };

  if (loading) return <div className="text-center py-8">Loading shifts...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Shifts</h1>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['upcoming', 'completed', 'all'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded font-medium ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Shifts List */}
      {shifts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No shifts scheduled.</div>
      ) : (
        <div className="space-y-3">
          {shifts.map(shift => (
            <div key={shift.id} className="p-4 bg-white rounded-lg shadow border border-gray-200">
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-semibold">{formatDate(shift.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-semibold">
                    {shift.startTime} - {shift.endTime}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      shift.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {shift.status}
                  </span>
                </div>
              </div>

              {shift.status !== 'completed' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedShift(shift);
                      setShowSwapModal(true);
                    }}
                    className="px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                  >
                    Request Swap
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Swap Requests Section */}
      {swapRequests.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">My Swap Requests</h2>
          <div className="space-y-3">
            {swapRequests.map(swap => (
              <div key={swap.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span>Shift swap request - {swap.status}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      swap.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : swap.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {swap.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {showSwapModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Request Shift Swap</h3>

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                {formatDate(selectedShift.date)} | {selectedShift.startTime} -{' '}
                {selectedShift.endTime}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <textarea
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
                placeholder="Why do you need to swap this shift?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSwapModal(false);
                  setSelectedShift(null);
                  setSwapReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleRequestSwap(selectedShift.id, 'any-available-tech')
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Request Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
