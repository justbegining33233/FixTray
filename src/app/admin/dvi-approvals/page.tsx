'use client';

import { useState, useEffect } from 'react';
import { formatDate, formatDateTime } from '@/lib/utils';

interface DVIApproval {
  id: string;
  inspectionId: string;
  vehicleId: string;
  vehicle?: { id: string; licensePlate: string; make: string; model: string };
  approvalStatus: string;
  notes?: string;
  inspectionDate: string;
  nextInspectionDue?: string;
  approvedBy?: { id: string; firstName: string; lastName: string };
  approvedAt: string;
}

export default function DVIApprovalsPage() {
  const [approvals, setApprovals] = useState<DVIApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchApprovals();
  }, [filter]);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/dvi-approvals?${filter === 'pending' ? 'pending=true' : `status=${filter}`}`
      );
      const data = await res.json();
      setApprovals(data);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const daysToNextInspection = prompt('Days until next inspection due? (e.g., 365 for annual)');
    if (!daysToNextInspection) return;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + parseInt(daysToNextInspection));

    try {
      await fetch(`/api/dvi-approvals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalStatus: 'approved',
          nextInspectionDue: nextDate.toISOString(),
        }),
      });
      fetchApprovals();
    } catch (error) {
      console.error('Error approving DVI:', error);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    try {
      await fetch(`/api/dvi-approvals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalStatus: 'rejected',
          notes: reason,
        }),
      });
      fetchApprovals();
    } catch (error) {
      console.error('Error rejecting DVI:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading approvals...</div>;
  }

  const stats = {
    pending: approvals.filter((a) => a.approvalStatus === 'pending').length,
    approved: approvals.filter((a) => a.approvalStatus === 'approved').length,
    rejected: approvals.filter((a) => a.approvalStatus === 'rejected').length,
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">DVI Approvals</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showForm ? 'Cancel' : '+ New Approval'}
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-yellow-100 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-3xl font-bold text-yellow-700">{stats.pending}</p>
        </div>
        <div className="bg-green-100 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Approved</p>
          <p className="text-3xl font-bold text-green-700">{stats.approved}</p>
        </div>
        <div className="bg-red-100 rounded-lg p-4">
          <p className="text-gray-600 text-sm">Rejected</p>
          <p className="text-3xl font-bold text-red-700">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-8">
        {['pending', 'approved', 'rejected'].map((tab) => (
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

      {/* Approvals List */}
      <div className="space-y-4">
        {approvals.filter((a) => a.approvalStatus === filter).length === 0 ? (
          <p className="text-gray-500 text-center py-8">No {filter} approvals</p>
        ) : (
          approvals
            .filter((a) => a.approvalStatus === filter)
            .map((approval) => (
              <div
                key={approval.id}
                className={`rounded-lg shadow p-6 hover:shadow-lg transition ${
                  approval.approvalStatus === 'pending'
                    ? 'bg-yellow-50 border-l-4 border-yellow-400'
                    : approval.approvalStatus === 'approved'
                    ? 'bg-green-50 border-l-4 border-green-400'
                    : 'bg-red-50 border-l-4 border-red-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      {approval.vehicle?.make} {approval.vehicle?.model}
                    </h3>
                    <p className="text-gray-600 mb-4">License: {approval.vehicle?.licensePlate}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Inspection Date:</span>
                        <p className="font-semibold">{formatDate(new Date(approval.inspectionDate))}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <p
                          className={`font-semibold ${
                            approval.approvalStatus === 'pending'
                              ? 'text-yellow-600'
                              : approval.approvalStatus === 'approved'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {approval.approvalStatus}
                        </p>
                      </div>
                      {approval.nextInspectionDue && (
                        <div>
                          <span className="text-gray-500">Next Due:</span>
                          <p className="font-semibold">{formatDate(new Date(approval.nextInspectionDue))}</p>
                        </div>
                      )}
                      {approval.approvedBy && (
                        <div>
                          <span className="text-gray-500">Approved By:</span>
                          <p className="font-semibold">
                            {approval.approvedBy.firstName} {approval.approvedBy.lastName}
                          </p>
                        </div>
                      )}
                    </div>

                    {approval.notes && (
                      <div className="mt-4">
                        <span className="text-gray-500 text-sm">Notes:</span>
                        <p className="text-gray-700">{approval.notes}</p>
                      </div>
                    )}
                  </div>

                  {approval.approvalStatus === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 whitespace-nowrap"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(approval.id)}
                        className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 whitespace-nowrap"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
