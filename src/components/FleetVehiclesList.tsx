'use client';

import { usePhrase } from '@/lib/usePhrase';
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
  const say = usePhrase();
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
    if (!confirm(say('Delete this vehicle?'))) return;

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

  if (loading) return <div>{say("Loading vehicles...")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">{say("Fleet Vehicles (")}{say(vehicles.length)})</h3>
        <Link
          href={`/shop/fleet/${fleetAccountId}/vehicles/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {say("+ Add Vehicle")}{' '}</Link>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-800 rounded">{say(error)}</div>}

      {vehicles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {say("No vehicles yet. Add one to get started.")}{' '}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left font-semibold">{say("Year")}</th>
                <th className="px-4 py-2 text-left font-semibold">{say("Make")}</th>
                <th className="px-4 py-2 text-left font-semibold">{say("Model")}</th>
                <th className="px-4 py-2 text-left font-semibold">{say("Unit #")}</th>
                <th className="px-4 py-2 text-left font-semibold">{say("License Plate")}</th>
                <th className="px-4 py-2 text-left font-semibold">{say("VIN")}</th>
                <th className="px-4 py-2 text-left font-semibold">{say("Mileage")}</th>
                <th className="px-4 py-2 text-center font-semibold">{say("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{say(vehicle.year)}</td>
                  <td className="px-4 py-2">{say(vehicle.make)}</td>
                  <td className="px-4 py-2">{say(vehicle.model)}</td>
                  <td className="px-4 py-2">{vehicle.unitNumber || '-'}</td>
                  <td className="px-4 py-2">{vehicle.licensePlate || '-'}</td>
                  <td className="px-4 py-2 text-xs font-mono">{vehicle.vin || '-'}</td>
                  <td className="px-4 py-2">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : '-'}</td>
                  <td className="px-4 py-2 text-center space-x-2">
                    <button
                      onClick={() => handleDelete(vehicle.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
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
