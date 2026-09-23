'use client';

import { usePhrase } from '@/lib/usePhrase';
import React from 'react';
import { WorkOrder } from '@/types/workorder';
import Link from 'next/link';
import { FaCar, FaTruck, FaWrench } from 'react-icons/fa';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  'waiting-for-payment': 'bg-purple-100 text-purple-800',
  closed: 'bg-green-100 text-green-800',
  'denied-estimate': 'bg-red-100 text-red-800',
};

function getServiceSummary(workOrder: WorkOrder): string {
  const services: string[] = [];
  
  if (workOrder.services.repairs?.length) {
    services.push(`${workOrder.services.repairs.length} repair(s)`);
  }
  if (workOrder.services.maintenance?.length) {
    services.push(`${workOrder.services.maintenance.length} maintenance`);
  }
  
  return services.join(', ') || 'No services specified';
}

export default function WorkOrderCard({ workOrder }: { workOrder: WorkOrder }) {
  const say = usePhrase();
  const vehicleTypeLabels: Record<string, React.ReactNode> = {
    'semi-truck': <><FaTruck style={{marginRight:4}} /> {say("Semi Truck")}</>,
    'trailer': <><FaTruck style={{marginRight:4}} /> {say("Trailer")}</>,
    'equipment': <><FaWrench style={{marginRight:4}} /> {say("Equipment")}</>,
    'personal-vehicle': <><FaCar style={{marginRight:4}} /> {say("Personal Vehicle")}</>,
  };
  return (
    <Link href={`/workorders/${workOrder.id}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer border border-gray-200">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {vehicleTypeLabels[workOrder.vehicleType]}
          </h3>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[workOrder.status as keyof typeof statusColors]}`}>
            {workOrder.status.replace('-', ' ').toUpperCase()}
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-3">{getServiceSummary(workOrder)}</p>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {say(workOrder.issueDescription.symptoms)}
        </p>

        <div className="flex justify-between items-center text-sm">
          {workOrder.createdBy && <span className="text-gray-600">{say(workOrder.createdBy)}</span>}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          {say("Created:")}{' '}{new Date(workOrder.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}
