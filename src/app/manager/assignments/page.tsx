'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCheck, FaHandPointLeft, FaUsers } from 'react-icons/fa';

interface WorkOrder {
  id: string;
  status: string;
  priority: string;
  vehicleType: string;
  serviceLocation: string;
  customer: { firstName: string; lastName: string };
  assignedTo?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface Tech {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  assignedWorkOrders: any[];
}

export default function AssignmentsPage() {
  const { user, isLoading } = useRequireAuth(['manager']);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);
  const [selectedTech, setSelectedTech] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [assignMsg, setAssignMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  // Show loading state while checking authentication
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
        Loading...
      </div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch work orders
      const woResponse = await fetch('/api/workorders', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (woResponse.ok) {
        const woData = await woResponse.json();
        setWorkOrders(woData.filter((wo: WorkOrder) => 
          wo.status === 'pending' || wo.status === 'assigned' || wo.status === 'in-progress'
        ));
      }

      // Fetch techs
      const techResponse = await fetch('/api/techs', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (techResponse.ok) {
        const techData = await techResponse.json();
        setTechs(techData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedWorkOrder || !selectedTech) {
      setAssignMsg({type:'error',text:'Please select both a work order and a technician'});
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/manager/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          workOrderId: selectedWorkOrder,
          techId: selectedTech,
        }),
      });

      if (response.ok) {
        setAssignMsg({type:'success',text:'Work order assigned successfully!'});
        setSelectedWorkOrder(null);
        setSelectedTech('');
        fetchData(); // Refresh data
      } else {
        const error = await response.json();
        setAssignMsg({type:'error',text:error.error || 'Failed to assign work order'});
      }
    } catch (error) {
      console.error('Error assigning work order:', error);
      setAssignMsg({type:'error',text:'Failed to assign work order'});
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/manager/dashboard" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaUsers style={{marginRight:4}} /> Assign Work Orders</h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>Distribute work to available technicians</p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 400px', gap: 24 }}>
          {/* Unassigned Work Orders */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Work Orders</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => setSelectedWorkOrder(wo.id)}
                  style={{
                    background: selectedWorkOrder === wo.id ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedWorkOrder === wo.id ? '2px solid rgba(229,51,42,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                      WO-{wo.id.slice(0, 8)}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: wo.status === 'pending' ? 'rgba(245,158,11,0.2)' : 'rgba(229,51,42,0.2)',
                      color: wo.status === 'pending' ? '#f59e0b' : '#ff6b64'
                    }}>
                      {wo.status}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 4 }}>
                    Customer: {wo.customer?.firstName} {wo.customer?.lastName}
                  </div>
                  <div style={{ fontSize: 13, color: '#9aa3b2', marginBottom: 4 }}>
                    Type: {wo.vehicleType} - {wo.serviceLocation}
                  </div>
                  {wo.assignedTo && (
                    <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                      <FaCheck style={{marginRight:4}} /> Assigned to: {wo.assignedTo.firstName} {wo.assignedTo.lastName}
                    </div>
                  )}
                </div>
              ))}
              {workOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#9aa3b2' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}><FaCheck style={{marginRight:4}} /></div>
                  <p>All work orders are assigned!</p>
                </div>
              )}
            </div>
          </div>

          {/* Available Technicians */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Technicians</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
              {techs.map((tech) => (
                <div
                  key={tech.id}
                  onClick={() => setSelectedTech(tech.id)}
                  style={{
                    background: selectedTech === tech.id ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedTech === tech.id ? '2px solid rgba(229,51,42,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
                        {tech.firstName} {tech.lastName}
                      </div>
                      <div style={{ fontSize: 12, color: '#9aa3b2' }}>{tech.role}</div>
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: (tech.assignedWorkOrders?.length || 0) > 3 ? 'rgba(229,51,42,0.2)' : 'rgba(16,185,129,0.2)',
                      color: (tech.assignedWorkOrders?.length || 0) > 3 ? '#e5332a' : '#10b981'
                    }}>
                      {tech.assignedWorkOrders?.length || 0} active
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#9aa3b2' }}>
                    Workload: {tech.assignedWorkOrders?.length || 0} jobs
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment Panel */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Assign Work</h2>
            
            {selectedWorkOrder && selectedTech ? (
              <div>
                <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Selected Work Order:</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb' }}>
                    WO-{selectedWorkOrder.slice(0, 8)}
                  </div>
                </div>

                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 8 }}>Assigned To:</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb' }}>
                    {techs.find(t => t.id === selectedTech)?.firstName} {techs.find(t => t.id === selectedTech)?.lastName}
                  </div>
                </div>

                <button
                  onClick={handleAssign}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #e5332a 0%, #c62822 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginBottom: 12
                  }}
                >
                  Confirm Assignment
                </button>

                <button
                  onClick={() => {
                    setSelectedWorkOrder(null);
                    setSelectedTech('');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#9aa3b2',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear Selection
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#9aa3b2' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}><FaHandPointLeft style={{marginRight:4}} /></div>
                <p style={{ fontSize: 14 }}>Select a work order and a technician to assign</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {assignMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:assignMsg.type==='success'?'#dcfce7':'#fde8e8',color:assignMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {assignMsg.text}
          <button onClick={()=>setAssignMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}

