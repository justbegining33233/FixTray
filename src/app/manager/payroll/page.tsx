'use client';

import { useState, useEffect } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaUsers, FaDollarSign } from 'react-icons/fa';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  payType: string;
  hourlyRate: number;
  salary?: number;
  available: boolean;
}

export default function ManagerPayrollPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const r = await fetch('/api/payroll/employees', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setEmployees(d.employees || d || []); }
      setLoading(false);
    };
    load();
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="manager" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(o => !o)} showMenuButton />
        <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <Breadcrumbs />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: '16px 0 24px' }}>Payroll</h1>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 40 }}>Loading...</div>
          ) : employees.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9aa3b2', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <FaUsers style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
              <p>No employees found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {employees.map(e => (
                <div key={e.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 16 }}>{e.firstName} {e.lastName}</span>
                    <span style={{ color: '#9aa3b2', fontSize: 13, marginLeft: 12 }}>{e.role}</span>
                    <span style={{ marginLeft: 8, background: e.available ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: e.available ? '#22c55e' : '#ef4444', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{e.available ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div style={{ color: '#9aa3b2', fontSize: 14 }}>
                    <FaDollarSign style={{ marginRight: 2 }} />
                    {e.payType === 'salary' ? `$${(e.salary || 0).toLocaleString()}/yr` : `$${e.hourlyRate.toFixed(2)}/hr`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

