'use client';

import { usePhrase } from '@/lib/usePhrase';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCheck, FaClock, FaUsers } from 'react-icons/fa';
import { OPEN_WORK_ORDER_STATUSES, isAwaitingClockIn, unwrapTechs, unwrapWorkOrders } from '@/lib/workOrderList';

interface WorkOrder {
  id: string;
  status: string;
  priority?: string;
  vehicleType?: string;
  serviceLocation?: string;
  assignedTechId?: string | null;
  customer?: { firstName: string; lastName: string };
  assignedTo?: { id: string; firstName: string; lastName: string };
  createdAt?: string;
}

interface Tech {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  assignedCount: number;
}

export default function AssignmentsPage() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['manager']);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e5e7eb',
        fontSize: '18px'
      }}>
        {say("Loading...")}{' '}</div>
    );
  }

  if (!user) {
    return null;
  }

  const fetchData = async () => {
    setLoadError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const statusQuery = OPEN_WORK_ORDER_STATUSES.join(',');

      const [woResponse, techResponse] = await Promise.all([
        fetch(`/api/workorders?limit=100&status=${encodeURIComponent(statusQuery)}`, { headers }),
        fetch('/api/techs', { headers }),
      ]);

      if (woResponse.ok) {
        const woData = await woResponse.json();
        setWorkOrders(unwrapWorkOrders(woData));
      } else {
        setWorkOrders([]);
        setLoadError('Could not load work orders.');
      }

      if (techResponse.ok) {
        const techData = await techResponse.json();
        setTechs(unwrapTechs(techData).map((tech: any) => ({
          id: tech.id,
          firstName: tech.firstName,
          lastName: tech.lastName,
          role: tech.role,
          assignedCount: Number(tech._count?.assignedWorkOrders ?? tech.assignedWorkOrders?.length ?? 0),
        })));
      } else {
        setTechs([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoadError('Could not load assignments.');
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>{say("Loading...")}</div>
      </div>
    );
  }

  const awaitingClockIn = workOrders.filter((wo) => isAwaitingClockIn(wo));
  const clockedIn = workOrders.filter((wo) => !isAwaitingClockIn(wo));

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/manager/dashboard" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaUsers style={{marginRight:4}} /> {say("Job Queue")}</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>
            {say("Clock-in is assignment. Open a work order so a technician can clock in — no separate assign step is required.")}{' '}</p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        {loadError && (
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: 14 }}>
            {say(loadError)}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>
              {say("Awaiting Clock-In (")}{say(awaitingClockIn.length)})
            </h2>
            <p style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 16 }}>
              {say("Open jobs with no technician clocked in yet.")}{' '}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
              {awaitingClockIn.map((wo) => (
                <Link
                  key={wo.id}
                  href={`/workorders/${wo.id}`}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 16,
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                      {say("WO-")}{wo.id.slice(0, 8)}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'rgba(245,158,11,0.2)',
                      color: '#f59e0b'
                    }}>
                      {say(wo.status)}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 4 }}>
                    {say("Customer:")}{' '}{say(wo.customer?.firstName)} {say(wo.customer?.lastName)}
                  </div>
                  <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 8 }}>
                    {say("Type:")}{' '}{say(wo.vehicleType)} - {say(wo.serviceLocation)}
                  </div>
                  <div style={{ fontSize: 12, color: '#e5332a', fontWeight: 700 }}>
                    {say("Open details")}{' '}</div>
                </Link>
              ))}
              {awaitingClockIn.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#9aa3b2' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}><FaCheck style={{marginRight:4}} /></div>
                  <p>
                    {workOrders.length === 0
                      ? say("No open work orders in the shop queue.")
                      : say("Every open work order already has a technician clocked in.")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>{say("Technicians")}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '40vh', overflowY: 'auto' }}>
                {techs.map((tech) => (
                  <div
                    key={tech.id}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                          {say(tech.firstName)} {say(tech.lastName)}
                        </div>
                        <div style={{ fontSize: 12, color: '#9aa3b2' }}>{say(tech.role)}</div>
                      </div>
                      <div style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: tech.assignedCount > 3 ? 'rgba(229,51,42,0.2)' : 'rgba(16,185,129,0.2)',
                        color: tech.assignedCount > 3 ? '#e5332a' : '#10b981'
                      }}>
                        {say(tech.assignedCount)} active
                      </div>
                    </div>
                  </div>
                ))}
                {techs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9aa3b2' }}>
                    {say("No technicians found for this shop.")}{' '}</div>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>
                <FaClock style={{marginRight:4}} /> {say("Clocked In (")}{say(clockedIn.length)})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {clockedIn.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/workorders/${wo.id}`}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: 16,
                      textDecoration: 'none',
                      display: 'block',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 4 }}>
                      {say("WO-")}{wo.id.slice(0, 8)}
                    </div>
                    <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                      {say(wo.assignedTo?.firstName)} {say(wo.assignedTo?.lastName)}
                    </div>
                  </Link>
                ))}
                {clockedIn.length === 0 && (
                  <div style={{ color: '#9aa3b2', fontSize: 13 }}>{say("No technicians are clocked into a job yet.")}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
