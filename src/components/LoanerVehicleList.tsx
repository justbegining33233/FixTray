'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LoanerVehicle {
  id: string;
  licensePlate: string;
  vehicleDesc: string;
  status: string;
  mileageOut?: number;
  checkedOutBy?: string;
  expectedBackDate?: string;
}

interface LoanerVehicleListProps {
  shopId?: string;
  onCheckout?: (vehicleId: string) => void;
  onCheckin?: (vehicleId: string) => void;
}

export function LoanerVehicleList({ shopId, onCheckout, onCheckin }: LoanerVehicleListProps) {
  const say = usePhrase();
  const [vehicles, setVehicles] = useState<LoanerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'available' | 'checked-out' | 'maintenance' | 'all'>('all');

  useEffect(() => {
    loadVehicles();
  }, [filter]);

  const loadVehicles = async () => {
    try {
      const currentShopId = shopId || localStorage.getItem('shopId');
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (currentShopId) params.append('shopId', currentShopId);

      const response = await fetch(
        `/api/loaner-vehicles?${params.toString()}`
      );
      if (!response.ok) throw new Error('Failed to load vehicles');
      const data = await response.json();
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(say('Delete this loaner vehicle?'))) return;

    try {
      const response = await fetch(`/api/loaner-vehicles/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete vehicle');
      loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting vehicle');
    }
  };

  if (loading) return <div className="text-center py-8">{say("Loading vehicles...")}</div>;
  if (error) return <div className="text-red-600 py-4">{say(error)}</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'available', 'checked-out', 'maintenance'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded font-medium ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Vehicles */}
      {vehicles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {say("No loaner vehicles found.")}{' '}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">{say("License Plate")}</th>
                <th className="text-left px-4 py-2 font-semibold">{say("Description")}</th>
                <th className="text-left px-4 py-2 font-semibold">{say("Status")}</th>
                <th className="text-left px-4 py-2 font-semibold">{say("Details")}</th>
                <th className="text-right px-4 py-2 font-semibold">{say("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(vehicle => (
                <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold">{say(vehicle.licensePlate)}</td>
                  <td className="px-4 py-3">{say(vehicle.vehicleDesc)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        vehicle.status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : vehicle.status === 'checked-out'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {say(vehicle.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {vehicle.status === 'checked-out' && (
                      <div>
                        <p>{say("By:")}{' '}{say(vehicle.checkedOutBy)}</p>
                        <p>
                          {say("Due:")}{' '}{say(vehicle.expectedBackDate)}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {vehicle.status === 'available' && (
                      <button
                        onClick={() => onCheckout?.(vehicle.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        {say("Checkout")}{' '}</button>
                    )}
                    {vehicle.status === 'checked-out' && (
                      <button
                        onClick={() => onCheckin?.(vehicle.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        {say("Checkin")}{' '}</button>
                    )}
                    <button
                      onClick={() => handleDelete(vehicle.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      {say("Delete")}{' '}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
