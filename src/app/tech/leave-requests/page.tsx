'use client';

import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LeaveRequestList } from '@/components/LeaveRequestList';

interface LeaveBalance {
  vacation: number;
  sick: number;
  personal: number;
  bereavement: number;
  parental: number;
}

export default function MyLeaveRequestsPage() {
  const say = usePhrase();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const techId = localStorage.getItem('userId');
      const response = await fetch(`/api/leave-requests?action=balance&techId=${techId}`);
      if (!response.ok) throw new Error('Failed to load balance');
      const data = await response.json();
      setBalance(data);
    } catch (err) {
      console.error('Error loading balance:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{say("Leave Requests")}</h1>
        <Link
          href="/tech/leave-requests/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {say("+ New Request")}{' '}</Link>
      </div>

      {/* PTO Balance */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600">{say("Vacation Days")}</p>
            <p className="text-2xl font-bold text-blue-600">{say(balance.vacation)}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-gray-600">{say("Sick Days")}</p>
            <p className="text-2xl font-bold text-red-600">{say(balance.sick)}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-gray-600">{say("Personal Days")}</p>
            <p className="text-2xl font-bold text-yellow-600">{say(balance.personal)}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-600">{say("Bereavement")}</p>
            <p className="text-2xl font-bold text-purple-600">{say(balance.bereavement)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-gray-600">{say("Parental")}</p>
            <p className="text-2xl font-bold text-green-600">{say(balance.parental)}</p>
          </div>
        </div>
      )}

      {/* Leave Requests */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-6">{say("My Requests")}</h2>
        <LeaveRequestList role="tech" />
      </div>
    </div>
  );
}
