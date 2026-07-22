'use client';

import { useState, useEffect } from 'react';

interface InspectionAlert {
  vin: string;
  licensePlate: string;
  daysUntilExpiration: number;
  result: string;
}

interface ComplianceStats {
  total: number;
  passed: number;
  failed: number;
  conditional: number;
}

export default function ComplianceDashboardPage() {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [expired, setExpired] = useState<InspectionAlert[]>([]);
  const [dueSoon, setDueSoon] = useState<InspectionAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      const shopId = localStorage.getItem('shopId');
      const response = await fetch(`/api/state-inspections?action=compliance&shopId=${shopId}`);
      if (!response.ok) throw new Error('Failed to load');

      const data = await response.json();
      setStats(data.stats);
      setExpired(data.alerts?.expired || []);
      setDueSoon(data.alerts?.dueSoon || []);
    } catch (err) {
      console.error('Error loading compliance data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Compliance Dashboard</h1>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600">Total Inspections</p>
            <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-gray-600">Passed</p>
            <p className="text-3xl font-bold text-green-600">{stats.passed}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-gray-600">Failed</p>
            <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-gray-600">Conditional</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.conditional}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expired */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-red-600">⚠️ Expired Inspections ({expired.length})</h2>
          {expired.length === 0 ? (
            <p className="text-gray-500">No expired inspections</p>
          ) : (
            <div className="space-y-2">
              {expired.map((item, i) => (
                <div key={i} className="p-3 bg-red-50 rounded border border-red-200">
                  <p className="font-semibold">{item.licensePlate}</p>
                  <p className="text-sm text-gray-600">VIN: {item.vin}</p>
                  <p className="text-xs text-red-600">Expired {Math.abs(item.daysUntilExpiration)} days ago</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Due Soon */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-yellow-600">🔔 Due Within 30 Days ({dueSoon.length})</h2>
          {dueSoon.length === 0 ? (
            <p className="text-gray-500">No inspections due soon</p>
          ) : (
            <div className="space-y-2">
              {dueSoon.map((item, i) => (
                <div key={i} className="p-3 bg-yellow-50 rounded border border-yellow-200">
                  <p className="font-semibold">{item.licensePlate}</p>
                  <p className="text-sm text-gray-600">VIN: {item.vin}</p>
                  <p className="text-xs text-yellow-600">Due in {item.daysUntilExpiration} days</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
