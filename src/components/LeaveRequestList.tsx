'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';

interface LeaveRequest {
  id: string;
  techId: string;
  techName: string;
  startDate: string;
  endDate: string;
  type: string;
  reason?: string;
  status: string;
  createdAt: string;
}

interface LeaveRequestListProps {
  shopId?: string;
  filter?: 'pending' | 'approved' | 'denied' | 'all';
  role?: 'tech' | 'manager';
}

export function LeaveRequestList({ shopId, filter = 'all', role = 'tech' }: LeaveRequestListProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentFilter, setCurrentFilter] = useState(filter);

  useEffect(() => {
    loadRequests();
  }, [currentFilter]);

  const loadRequests = async () => {
    try {
      const currentShopId = shopId || localStorage.getItem('shopId');
      const queryParams = new URLSearchParams();
      if (currentFilter !== 'all') queryParams.append('status', currentFilter);
      if (currentShopId) queryParams.append('shopId', currentShopId);

      const response = await fetch(
        `/api/leave-requests?${queryParams.toString()}`
      );
      if (!response.ok) throw new Error('Failed to load leave requests');
      const data = await response.json();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) throw new Error('Failed to approve request');
      loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error approving request');
    }
  };

  const handleDeny = async (requestId: string) => {
    try {
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'denied' }),
      });

      if (!response.ok) throw new Error('Failed to deny request');
      loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error denying request');
    }
  };

  if (loading) return <div className="text-center py-8">Loading leave requests...</div>;
  if (error) return <div className="text-red-600 py-4">{error}</div>;

  const typeColors: Record<string, string> = {
    vacation: 'bg-blue-100 text-blue-800',
    sick: 'bg-red-100 text-red-800',
    personal: 'bg-yellow-100 text-yellow-800',
    bereavement: 'bg-purple-100 text-purple-800',
    parental: 'bg-green-100 text-green-800',
  };

  return (
    <div className="space-y-4">
      {/* Filters for manager view */}
      {role === 'manager' && (
        <div className="flex gap-2 mb-6">
          {(['pending', 'approved', 'denied', 'all'] as const).map(status => (
            <button
              key={status}
              onClick={() => setCurrentFilter(status)}
              className={`px-4 py-2 rounded font-medium ${
                currentFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No leave requests to display.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
            <div
              key={request.id}
              className="p-4 bg-white rounded-lg shadow border border-gray-200"
            >
              <div className="grid grid-cols-4 gap-4 mb-3">
                {role === 'manager' && (
                  <div>
                    <p className="text-sm text-gray-600">Technician</p>
                    <p className="font-semibold">{request.techName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Dates</p>
                  <p className="font-semibold text-sm">
                    {formatDate(request.startDate)} to{' '}
                    {formatDate(request.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      typeColors[request.type] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {request.type.charAt(0).toUpperCase() + request.type.slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      request.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </span>
                </div>
              </div>

              {request.reason && (
                <div className="bg-gray-50 p-2 rounded text-sm mb-3">
                  <p className="text-gray-600">Reason:</p>
                  <p>{request.reason}</p>
                </div>
              )}

              {role === 'manager' && request.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(request.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(request.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
