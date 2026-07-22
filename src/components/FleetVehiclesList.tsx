'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FleetVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  licensePlate?: string;
  unitNumber?: string;
  mileage?: number;
  notes?: string;
}

export function FleetVehiclesList({ fleetAccountId }: { fleetAccountId: string }) {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVehicles();
  }, [fleetAccountId]);

  const loadVehicles = async () => {
    try {
      const response = await fetch(`/api/fleet-accounts/${fleetAccountId}/vehicles`);
      if (!response.ok) throw new Error('Failed to load vehicles');
      const data = await response.json();
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (vehicleId: string) => {
    if (!confirm('Delete this vehicle?')) return;

    try {
      const response = await fetch(`/api/fleet-vehicles/${vehicleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete vehicle');
      setVehicles(vehicles.filter(v => v.id !== vehicleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting vehicle');
    }
  };

  if (loading) return <div>Loading vehicles...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Fleet Vehicles ({vehicles.length})</h3>
        <Link
          href={`/shop/fleet/${fleetAccountId}/vehicles/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add Vehicle
        </Link>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-800 rounded">{error}</div>}

      {vehicles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No vehicles yet. Add one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left font-semibold">Year</th>
                <th className="px-4 py-2 text-left font-semibold">Make</th>
                <th className="px-4 py-2 text-left font-semibold">Model</th>
                <th className="px-4 py-2 text-left font-semibold">Unit #</th>
                <th className="px-4 py-2 text-left font-semibold">License Plate</th>
                <th className="px-4 py-2 text-left font-semibold">VIN</th>
                <th className="px-4 py-2 text-left font-semibold">Mileage</th>
                <th className="px-4 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{vehicle.year}</td>
                  <td className="px-4 py-2">{vehicle.make}</td>
                  <td className="px-4 py-2">{vehicle.model}</td>
                  <td className="px-4 py-2">{vehicle.unitNumber || '-'}</td>
                  <td className="px-4 py-2">{vehicle.licensePlate || '-'}</td>
                  <td className="px-4 py-2 text-xs font-mono">{vehicle.vin || '-'}</td>
                  <td className="px-4 py-2">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : '-'}</td>
                  <td className="px-4 py-2 text-center space-x-2">
                    <button
                      onClick={() => handleDelete(vehicle.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
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
