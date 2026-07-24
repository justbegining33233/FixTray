'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FleetVehiclesList } from '@/components/FleetVehiclesList';
import { formatCurrency, formatDate } from '@/lib/utils';

interface FleetAccount {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  billingAddress?: string;
  taxId?: string;
  netTerms: number;
  creditLimit: number;
  notes?: string;
  status: string;
  vehicles: Array<{ id: string }>;
  invoices: Array<{ id: string; totalAmount: number; amountPaid: number; status: string }>;
}

export default function FleetAccountDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [account, setAccount] = useState<FleetAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccount();
  }, [id]);

  const loadAccount = async () => {
    try {
      const response = await fetch(`/api/fleet-accounts/${id}`);
      if (!response.ok) throw new Error('Failed to load account');
      const data = await response.json();
      setAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading account');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading account...</div>;
  if (error) return <div className="text-red-600 py-4">{error}</div>;
  if (!account) return <div className="text-center py-8">Account not found</div>;

  const totalRevenue = account.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = account.invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const unpaidAmount = totalRevenue - totalPaid;
  const usedCredit = account.invoices
    .filter(inv => inv.status === 'unpaid')
    .reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{account.companyName}</h1>
          <p className="text-gray-600">Fleet Account • {account.status}</p>
        </div>
        <Link
          href={`/shop/fleet/${id}/edit` as any}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Edit Account
        </Link>
      </div>

      {/* Account Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-600 mb-2">Contact</h3>
          <p className="font-bold">{account.contactName}</p>
          <p className="text-sm text-gray-600">{account.contactEmail}</p>
          {account.contactPhone && (
            <p className="text-sm text-gray-600">{account.contactPhone}</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-600 mb-2">Terms</h3>
          <p className="text-sm">
            Net {account.netTerms} days
          </p>
          <p className="text-sm mt-2">
            Credit Limit: <span className="font-bold">{formatCurrency(account.creditLimit)}</span>
          </p>
          <p className="text-sm">
            Available Credit: <span className="font-bold text-blue-600">{formatCurrency(account.creditLimit - usedCredit)}</span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-600 mb-2">Billing</h3>
          <p className="text-sm">
            Billing Address:
          </p>
          <p className="text-sm font-mono">{account.billingAddress || 'Not provided'}</p>
          {account.taxId && (
            <p className="text-sm mt-2">Tax ID: {account.taxId}</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold text-gray-600 mb-2">Revenue</h3>
          <p className="text-sm">
            Total Revenue: <span className="font-bold text-green-600">{formatCurrency(totalRevenue)}</span>
          </p>
          <p className="text-sm mt-1">
            Amount Paid: <span className="font-bold">{formatCurrency(totalPaid)}</span>
          </p>
          <p className="text-sm mt-1">
            Unpaid: <span className="font-bold text-orange-600">{formatCurrency(unpaidAmount)}</span>
          </p>
        </div>
      </div>

      {/* Fleet Vehicles Section */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <FleetVehiclesList fleetAccountId={id} />
      </div>

      {/* Invoices Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Invoices</h2>
          <Link
            href={`/shop/fleet/${id}/invoices/new`}
            className="text-blue-600 hover:underline text-sm"
          >
            Create Invoice
          </Link>
        </div>

        {account.invoices.length === 0 ? (
          <p className="text-gray-500">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Invoice #</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Paid</th>
                  <th className="px-4 py-2 text-left">Due</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {account.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">INV-{inv.id.slice(0, 8)}</td>
                    <td className="px-4 py-2">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-2">{formatCurrency(inv.amountPaid)}</td>
                    <td className="px-4 py-2">{inv.totalAmount - inv.amountPaid > 0 ? formatCurrency(inv.totalAmount - inv.amountPaid) : 'Paid'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          inv.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : inv.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {account.notes && (
        <div className="bg-white p-6 rounded-lg shadow mt-8">
          <h3 className="font-bold mb-2">Notes</h3>
          <p className="text-gray-700">{account.notes}</p>
        </div>
      )}
    </div>
  );
}
