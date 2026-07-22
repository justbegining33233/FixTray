'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';

interface SwapRequest {
  id: string;
  shiftId: string;
  requestingTechId: string;
  requestingTechName: string;
  targetTechId: string;
  targetTechName: string;
  status: string;
  reason?: string;
  createdAt: string;
  shift?: {
    date: string;
    startTime: string;
    endTime: string;
  };
}

interface SwapRequestListProps {
  shopId?: string;
  onApprove?: (swapId: string) => void;
  onDeny?: (swapId: string) => void;
}

export function SwapRequestList({ shopId, onApprove, onDeny }: SwapRequestListProps) {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'pending' | 'approved' | 'denied'>('pending');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    try {
      const currentShopId = shopId || localStorage.getItem('shopId');
      const response = await fetch(
        `/api/shift-swaps?status=${filter}&shopId=${currentShopId}`
      );
      if (!response.ok) throw new Error('Failed to load swap requests');
      const data = await response.json();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading swap requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (swapId: string) => {
    try {
      const response = await fetch(`/api/shift-swaps/${swapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!response.ok) throw new Error('Failed to approve swap');

      onApprove?.(swapId);
      loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error approving swap');
    }
  };

  const handleDeny = async (swapId: string) => {
    try {
      const response = await fetch(`/api/shift-swaps/${swapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deny' }),
      });

      if (!response.ok) throw new Error('Failed to deny swap');

      onDeny?.(swapId);
      loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error denying swap');
    }
  };

  if (loading) return <div className="text-center py-8">Loading swap requests...</div>;
  if (error) return <div className="text-red-600 py-4">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'denied'] as const).map(status => (
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

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No {filter} swap requests.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
            <div
              key={request.id}
              className="p-4 bg-white rounded-lg shadow border border-gray-200"
            >
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-600">Requesting</p>
                  <p className="font-semibold">{request.requestingTechName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Wants to swap with</p>
                  <p className="font-semibold">{request.targetTechName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Shift Date</p>
                  <p className="font-semibold">
                    {request.shift?.date ? formatDate(request.shift.date) : 'N/A'}
                  </p>
                </div>
              </div>

              {request.shift && (
                <div className="text-sm text-gray-600 mb-3">
                  Shift: {request.shift.startTime} - {request.shift.endTime}
                </div>
              )}

              {request.reason && (
                <div className="bg-gray-50 p-2 rounded text-sm mb-3">
                  <p className="text-gray-600">Reason:</p>
                  <p>{request.reason}</p>
                </div>
              )}

              <div className="flex gap-2">
                {request.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => handleApprove(request.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(request.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Deny
                    </button>
                  </>
                ) : (
                  <span className={`px-3 py-2 rounded text-sm font-medium ${
                    request.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
