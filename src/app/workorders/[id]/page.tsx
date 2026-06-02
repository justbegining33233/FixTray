'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type WorkOrderRecord = {
  id: string;
  status?: string;
  issueDescription?: string;
  serviceType?: string;
  createdAt?: string;
  dueDate?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    licensePlate?: string;
  };
  assignedTo?: {
    firstName?: string;
    lastName?: string;
  };
};

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workOrderId = params?.id;

  const [workOrder, setWorkOrder] = useState<WorkOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchWorkOrder = async () => {
      if (!workOrderId) {
        setError('Missing work order id.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await fetch(`/api/workorders/${workOrderId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Work order not found.');
          } else if (response.status === 401 || response.status === 403) {
            setError('You are not authorized to view this work order.');
          } else {
            setError('Unable to load work order details right now.');
          }
          return;
        }

        const payload = await response.json();
        setWorkOrder(payload?.workOrder ?? payload ?? null);
      } catch {
        setError('Unable to load work order details right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkOrder();
  }, [workOrderId]);

  const customerName = useMemo(() => {
    const first = workOrder?.customer?.firstName?.trim() ?? '';
    const last = workOrder?.customer?.lastName?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full || 'Not provided';
  }, [workOrder]);

  const vehicleLabel = useMemo(() => {
    const vehicle = workOrder?.vehicle;
    if (!vehicle) return 'Not provided';
    const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
    return parts || 'Not provided';
  }, [workOrder]);

  return (
    <main className="role-route-shell">
      <section data-page-shell style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px 96px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
          >
            Back
          </button>
          <Link href="/workorders/list" className="btn-primary">All Work Orders</Link>
          <span style={{ color: '#9ca3af', fontSize: 14 }}>Legacy detail route restored</span>
        </div>

        {loading && (
          <div style={{ padding: 24, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }}>
            Loading work order...
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 24, borderRadius: 12, border: '1px solid rgba(239,68,68,0.45)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {!loading && !error && workOrder && (
          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h1 style={{ margin: 0, fontSize: 26, color: '#f8fafc' }}>Work Order #{workOrder.id}</h1>
              <p style={{ marginTop: 6, marginBottom: 0, color: '#9ca3af' }}>
                Status: {workOrder.status ?? 'unknown'}
              </p>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div>
                <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 18 }}>Issue</h2>
                <p style={{ marginBottom: 0, color: '#e5e7eb' }}>{workOrder.issueDescription || 'No description provided.'}</p>
              </div>

              <div>
                <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 18 }}>Customer</h2>
                <p style={{ marginBottom: 4, color: '#e5e7eb' }}>{customerName}</p>
                <p style={{ margin: 0, color: '#9ca3af' }}>{workOrder.customer?.email || workOrder.customer?.phone || 'No contact provided'}</p>
              </div>

              <div>
                <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 18 }}>Vehicle</h2>
                <p style={{ marginBottom: 4, color: '#e5e7eb' }}>{vehicleLabel}</p>
                <p style={{ margin: 0, color: '#9ca3af' }}>{workOrder.vehicle?.licensePlate || 'No plate provided'}</p>
              </div>

              <div>
                <h2 style={{ marginTop: 0, color: '#f8fafc', fontSize: 18 }}>Assignment</h2>
                <p style={{ marginBottom: 4, color: '#e5e7eb' }}>
                  {workOrder.assignedTo
                    ? `${workOrder.assignedTo.firstName || ''} ${workOrder.assignedTo.lastName || ''}`.trim() || 'Assigned'
                    : 'Unassigned'}
                </p>
                <p style={{ margin: 0, color: '#9ca3af' }}>Service type: {workOrder.serviceType || 'Not specified'}</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
