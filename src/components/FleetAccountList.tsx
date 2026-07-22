'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface FleetAccount {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: string;
  vehicles: Array<{ id: string }>;
  invoices: Array<{ totalAmount: number; status: string }>;
  createdAt: string;
}

export function FleetAccountList() {
  const [accounts, setAccounts] = useState<FleetAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const shopId = localStorage.getItem('shopId');
      const response = await fetch(`/api/fleet-accounts?shopId=${shopId}`);
      if (!response.ok) throw new Error('Failed to load accounts');
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading accounts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading fleet accounts...</div>;
  if (error) return <div className="text-red-600 py-4">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fleet Accounts</h2>
        <Link
          href="/shop/fleet/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + New Fleet Account
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No fleet accounts yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => {
            const totalRevenue = account.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
            const vehicleCount = account.vehicles.length;

            return (
              <Link
                key={account.id}
                href={`/shop/fleet/${account.id}`}
                className="p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
              >
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{account.companyName}</h3>
                    <p className="text-sm text-gray-600">{account.contactName}</p>
                    <p className="text-xs text-gray-500">{account.contactEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        account.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {account.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Vehicles</p>
                    <p className="text-lg font-semibold">{vehicleCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-lg font-semibold">{formatCurrency(totalRevenue)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
