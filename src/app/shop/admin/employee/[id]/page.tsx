'use client';
import { FaArrowLeft, FaCheck, FaEdit, FaEnvelope, FaMobileAlt, FaRegCircle, FaSave, FaUserTie, FaWrench } from 'react-icons/fa';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

export default function EmployeeProfile() {
  useRequireAuth(['shop']);
  const router = useRouter();
  const params = useParams();
  const employeeId = (params?.id as string) || '';
  
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState('');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [employeeMsg, setEmployeeMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  useEffect(() => {
    const admin = localStorage.getItem('isShopAdmin');
    const id = localStorage.getItem('shopId') || '';

    if (admin !== 'true') {
      router.push('/shop/home' as Route);
      return;
    }

    setShopId(id);
    if (id && employeeId) {
      fetchEmployeeData(id, employeeId);
    }

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (id && employeeId) {
        fetchEmployeeData(id, employeeId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router, employeeId]);

  const fetchEmployeeData = async (shopId: string, empId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch employee details directly by ID
      const response = await fetch(`/api/techs/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const emp = data.tech;
        
        if (emp) {
          setEmployee(emp);
          setFormData({
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            phone: emp.phone,
            hourlyRate: emp.hourlyRate,
            role: emp.role,
            available: emp.available,
          });
        } else {
          console.error('Employee not found');
          router.push('/shop/admin?tab=team' as Route);
        }
      } else {
        console.error('Failed to fetch employee data');
        router.push('/shop/admin?tab=team' as Route);
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      router.push('/shop/admin?tab=team' as Route);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmployee = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/techs/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setEmployeeMsg({type:'success',text:'Employee updated successfully'});
        setEditing(false);
        fetchEmployeeData(shopId, employeeId);
      } else {
        setEmployeeMsg({type:'error',text:`Failed to update employee: ${data.error || 'Unknown error'}${data.details ? '\n' + data.details : ''}` });
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      setEmployeeMsg({type:'error',text:'Error updating employee: ' + (error as Error).message});
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 18 }}>Loading...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 18 }}>Employee not found</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Employee Profile</h1>
      {/* Header */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(229,51,42,0.3)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/shop/admin?tab=team" style={{ fontSize: 24, fontWeight: 900, color: '#e5332a', textDecoration: 'none' }}>
            SOS
          </Link>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>Employee Profile</div>
            <div style={{ fontSize: 12, color: '#9aa3b2' }}>{employee.firstName} {employee.lastName}</div>
          </div>
        </div>
        <Link href="/shop/admin?tab=team" style={{
          padding: '8px 16px',
          background: '#4b5563',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
        }}>
          <FaArrowLeft style={{marginRight:4}} /> Back to Team
        </Link>
      </div>

      {/* Content */}
      <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* Left Column - Profile Card */}
          <div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: employee.role === 'manager' ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  margin: '0 auto 16px',
                }}>
                  {employee.role === 'manager' ? <FaUserTie style={{marginRight:4}} /> : <FaWrench style={{marginRight:4}} />}
                </div>
                <div style={{ color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                  {employee.firstName} {employee.lastName}
                </div>
                <div style={{ color: '#9aa3b2', fontSize: 14 }}>
                  {employee.role === 'manager' ? 'Manager' : 'Technician'}
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20, display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ color: '#9aa3b2', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    background: employee.available ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)',
                    border: `1px solid ${employee.available ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
                    borderRadius: 6,
                    color: employee.available ? '#22c55e' : '#9aa3b2',
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {employee.available ? <><FaCheck style={{marginRight:4}} /> Available</> : <><FaRegCircle style={{marginRight:4}} /> Unavailable</>}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#9aa3b2', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Employee ID</div>
                  <div style={{ color: '#e5e7eb', fontSize: 13, fontFamily: 'monospace' }}>{employee.id}</div>
                </div>

                <div>
                  <div style={{ color: '#9aa3b2', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Joined Date</div>
                  <div style={{ color: '#e5e7eb', fontSize: 13 }}>
                    {new Date(employee.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#9aa3b2', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Active Work Orders</div>
                  <div style={{ color: '#3b82f6', fontSize: 20, fontWeight: 700 }}>
                    {employee._count?.assignedWorkOrders || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Contact Information */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: '#e5e7eb', fontSize: 18, margin: 0 }}>Contact Information</h3>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    <FaEdit style={{marginRight:4}} /> Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ color: '#9aa3b2', fontSize: 13, display: 'block', marginBottom: 8 }}>First Name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#9aa3b2', fontSize: 13, display: 'block', marginBottom: 8 }}>Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ color: '#9aa3b2', fontSize: 13, display: 'block', marginBottom: 8 }}>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ color: '#9aa3b2', fontSize: 13, display: 'block', marginBottom: 8 }}>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={handleUpdateEmployee}
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        background: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {loading ? 'Saving...' : <><FaSave style={{marginRight:4}} /> Save Changes</>}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setFormData({
                          firstName: employee.firstName,
                          lastName: employee.lastName,
                          email: employee.email,
                          phone: employee.phone,
                          hourlyRate: employee.hourlyRate,
                          role: employee.role,
                          available: employee.available,
                        });
                      }}
                      style={{
                        padding: '10px 20px',
                        background: '#4b5563',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18 }}><FaEnvelope style={{marginRight:4}} /></span>
                    <div>
                      <div style={{ color: '#9aa3b2', fontSize: 11 }}>Email</div>
                      <div style={{ color: '#e5e7eb', fontSize: 14 }}>{employee.email}</div>
                    </div>
                  </div>
                  {employee.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18 }}><FaMobileAlt style={{marginRight:4}} /></span>
                      <div>
                        <div style={{ color: '#9aa3b2', fontSize: 11 }}>Phone</div>
                        <div style={{ color: '#e5e7eb', fontSize: 14 }}>{employee.phone}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Employment Details */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ color: '#e5e7eb', fontSize: 18, marginBottom: 20 }}>Employment Details</h3>
              
              {editing ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <label style={{ color: '#9aa3b2', fontSize: 13, display: 'block', marginBottom: 8 }}>Hourly Rate</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: 10, color: '#9aa3b2' }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.hourlyRate || ''}
                        onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '10px 10px 10px 28px',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ color: '#9aa3b2', fontSize: 13, display: 'block', marginBottom: 8 }}>Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white',
                      }}
                    >
                      <option value="tech">Technician</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ color: '#9aa3b2', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={formData.available}
                        onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                      />
                      Available for work assignments
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <div style={{ color: '#9aa3b2', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Hourly Rate</div>
                    <div style={{ color: '#22c55e', fontSize: 24, fontWeight: 700 }}>
                      ${employee.hourlyRate ? employee.hourlyRate.toFixed(2) : '0.00'}/hr
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#9aa3b2', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Position</div>
                    <div style={{ color: '#e5e7eb', fontSize: 16 }}>
                      {employee.role === 'manager' ? <><FaUserTie style={{marginRight:4}} /> Manager</> : <><FaWrench style={{marginRight:4}} /> Technician</>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {employeeMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:employeeMsg.type==='success'?'#dcfce7':'#fde8e8',color:employeeMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {employeeMsg.text}
          <button onClick={()=>setEmployeeMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>├ù</button>
        </div>
      )}
    </div>
  );
}
