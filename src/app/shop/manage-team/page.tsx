'use client';

import React, { useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCircle, FaUserTie, FaUsers, FaWrench } from 'react-icons/fa';

interface TeamMember {
  id: string;
  employeeNumber?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
  assignedJobs: number;
  joinedDate: string;
}

interface StoredEmployee {
  employeeNumber?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  createdAt?: string;
}

export default function ManageTeamPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'admin']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({ employeeNumber: '', name: '', role: 'tech', email: '', phone: '', password: '' });
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [editError, setEditError] = useState('');

  const fetchAutoEmployeeNumber = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/techs/next-employee-number', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.employeeNumber) {
        setNewMember((prev) => ({ ...prev, employeeNumber: String(data.employeeNumber) }));
      }
    } catch {
      // Keep form usable even if auto-number lookup fails.
    }
  };

  const openAddModal = async () => {
    setFormError('');
    setNewMember({ employeeNumber: '', name: '', role: 'tech', email: '', phone: '', password: '' });
    setShowAddModal(true);
    await fetchAutoEmployeeNumber();
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load team members on mount
  React.useEffect(() => {
    if (!user) return;
    loadTeamMembers();
  }, [user]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const loadTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const shopId = localStorage.getItem('shopId');
      
      if (!shopId) {
        console.error('No shopId found in localStorage');
        return;
      }

      const response = await fetch(`/api/techs?shopId=${shopId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const techs = data.techs || [];
        
        const loadedMembers = techs.map((tech: any) => ({
          id: tech.id,
          employeeNumber: tech.employeeNumber || '',
          name: `${tech.firstName} ${tech.lastName}`,
          role: tech.role,
          email: tech.email,
          phone: tech.phone || '',
          status: tech.available ? 'active' : 'inactive',
          assignedJobs: tech._count?.assignedWorkOrders || 0,
          joinedDate: tech.createdAt
        }));
        setTeamMembers(loadedMembers);
      } else {
        // Fallback to localStorage if API fails
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('shopEmployees');
          if (stored) {
            const employees = JSON.parse(stored);
            // Filter by current shopId
            const shopEmployees = employees.filter((emp: any) => emp.shopId === shopId);
            const loadedMembers = shopEmployees.map((emp: StoredEmployee, idx: number) => ({
              id: `emp-${idx}`,
              employeeNumber: emp.employeeNumber || '',
              name: emp.name,
              role: emp.role,
              email: emp.email,
              phone: emp.phone,
              status: 'active',
              assignedJobs: 0,
              joinedDate: emp.createdAt || new Date().toISOString()
            }));
            setTeamMembers(loadedMembers);
          }
        }
      }
    } catch (error) {
      console.error('Error loading team members:', error);
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const shopId = localStorage.getItem('shopId');
        const stored = localStorage.getItem('shopEmployees');
        if (stored) {
          const employees = JSON.parse(stored);
          // Filter by current shopId
          const shopEmployees = employees.filter((emp: any) => emp.shopId === shopId);
          const loadedMembers = shopEmployees.map((emp: StoredEmployee, idx: number) => ({
            id: `emp-${idx}`,
            employeeNumber: emp.employeeNumber || '',
            name: emp.name,
            role: emp.role,
            email: emp.email,
            phone: emp.phone,
            status: 'active',
            assignedJobs: 0,
            joinedDate: emp.createdAt || new Date().toISOString()
          }));
          setTeamMembers(loadedMembers);
        }
      }
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email || !newMember.phone || !newMember.password) {
      setFormError('Please fill in all fields');
      return;
    }
    setFormError('');
    try {
      const token = localStorage.getItem('token');
      const nameParts = newMember.name.trim().split(' ');
      const firstName = nameParts[0] || newMember.name;
      const lastName = nameParts.slice(1).join(' ') || nameParts[0];
      const response = await fetch('/api/techs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          employeeNumber: newMember.employeeNumber || undefined,
          email: newMember.email,
          password: newMember.password,
          firstName,
          lastName,
          phone: newMember.phone,
          role: newMember.role,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        setFormError(error.error || 'Failed to add team member');
        return;
      }
      const created = await response.json();
      setShowAddModal(false);
      setNewMember({ employeeNumber: '', name: '', role: 'tech', email: '', phone: '', password: '' });
      showToast(created.employeeNumber ? `Team member added. Employee #: ${created.employeeNumber}` : 'Team member added successfully!');
      loadTeamMembers();
    } catch (error) {
      console.error('Error adding team member:', error);
      setFormError('Failed to add team member. Please try again.');
    }
  };

  const handleRemoveMember = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/techs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTeamMembers((prev) => prev.filter((m) => m.id !== id));
        showToast('Team member removed successfully.');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to remove team member', 'error');
      }
    } catch {
      showToast('Failed to remove team member. Please try again.', 'error');
    } finally {
      setRemoveConfirmId(null);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    const nameParts = member.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    setEditingMember({
      id: member.id,
      firstName,
      lastName,
      email: member.email,
      phone: member.phone,
      role: member.role,
      hourlyRate: 0 // Default value, will be fetched from API
    });
    setShowEditModal(true);
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !editingMember.firstName || !editingMember.email || !editingMember.phone) {
      setEditError('Please fill in all required fields');
      return;
    }
    setEditError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/techs/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          firstName: editingMember.firstName,
          lastName: editingMember.lastName,
          email: editingMember.email,
          phone: editingMember.phone,
          hourlyRate: parseFloat(editingMember.hourlyRate) || 0,
          role: editingMember.role,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEditError(data.error || 'Failed to update team member');
        return;
      }
      showToast('Team member updated successfully!');
      setShowEditModal(false);
      setEditingMember(null);
      loadTeamMembers();
    } catch (error) {
      console.error('Error updating team member:', error);
      setEditError('Failed to update team member. Please try again.');
    }
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent', display:'flex', flexDirection:'column'}}>
      {/* Top Navigation */}
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton={true} />
      
      {/* Breadcrumbs */}
      <Breadcrumbs />
      
      {/* Main Layout with Sidebar */}
      <div style={{display:'flex', flex:1}}>
        {/* Sidebar */}
        <Sidebar role="shop" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Main Content */}
        <div style={{flex:1, overflowY:'auto'}}>
          <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
            {/* Page Header */}
            <div style={{marginBottom:24}}>
              <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaUsers style={{marginRight:4}} /> Manage Team</h1>
              <p style={{fontSize:14, color:'#9aa3b2'}}>Add and manage your shop team members</p>
              <button 
                onClick={openAddModal}
                style={{marginTop:16, padding:'12px 24px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                + Add Team Member
              </button>
            </div>

      <div style={{maxWidth:1200, margin:'0 auto'}}>
        {/* Team Members List */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
          {teamMembers.length === 0 ? (
            <div style={{textAlign:'center', padding:40}}>
              <div style={{fontSize:48, marginBottom:16}}><FaUsers style={{marginRight:4}} /></div>
              <h3 style={{fontSize:20, fontWeight:600, color:'#e5e7eb', marginBottom:8}}>No Team Members Yet</h3>
              <p style={{color:'#9aa3b2', marginBottom:20}}>Add technicians and managers to your team</p>
              <button 
                onClick={openAddModal}
                style={{padding:'12px 24px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                + Add First Team Member
              </button>
            </div>
          ) : (
            <div style={{display:'grid', gap:16}}>
              {teamMembers.map((member) => (
                <div key={member.id} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
                        <span style={{fontSize:32}}>{member.role === 'tech' ? <FaWrench style={{marginRight:4}} /> : <FaUserTie style={{marginRight:4}} />}</span>
                        <div>
                          <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{member.name}</h3>
                          <div style={{display:'flex', gap:8}}>
                            <span style={{padding:'4px 12px', background:member.role === 'tech' ? 'rgba(34,197,94,0.2)' : 'rgba(229,51,42,0.2)', color:member.role === 'tech' ? '#22c55e' : '#e5332a', borderRadius:12, fontSize:12, fontWeight:600}}>
                              {member.role === 'tech' ? 'Technician' : 'Manager'}
                            </span>
                            <span style={{padding:'4px 12px', background: member.status === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)', color: member.status === 'active' ? '#22c55e' : '#9ca3af', borderRadius:12, fontSize:12, fontWeight:600}}>
                              <FaCircle style={{marginRight:4}} /> {member.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16}}>
                        <div>
                          <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>Employee #</div>
                          <div style={{fontSize:14, color:'#e5e7eb'}}>{member.employeeNumber || 'Pending'}</div>
                        </div>
                        <div>
                          <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>Email</div>
                          <div style={{fontSize:14, color:'#e5e7eb'}}>{member.email}</div>
                        </div>
                        <div>
                          <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>Phone</div>
                          <div style={{fontSize:14, color:'#e5e7eb'}}>{member.phone}</div>
                        </div>
                        <div>
                          <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>Assigned Jobs</div>
                          <div style={{fontSize:14, color:'#e5e7eb'}}>{member.assignedJobs}</div>
                        </div>
                        <div>
                          <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>Joined</div>
                          <div style={{fontSize:14, color:'#e5e7eb'}}>{new Date(member.joinedDate).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:8}}>
                      <button 
                        onClick={() => handleEditMember(member)}
                        style={{padding:'8px 16px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer'}}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => setRemoveConfirmId(member.id)}
                        style={{padding:'8px 16px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer'}}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
          <div style={{background:'#000000', border:'1px solid rgba(255,255,255,0.2)', borderRadius:16, padding:32, maxWidth:500, width:'90%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>Add Team Member</h2>
              <button onClick={() => setShowAddModal(false)} style={{background:'transparent', border:'none', color:'#9aa3b2', fontSize:24, cursor:'pointer', padding:0}}></button>
            </div>

            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Role *</label>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <button type="button" onClick={() => setNewMember({...newMember, role: 'tech'})} style={{padding:16, background:newMember.role === 'tech' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', border:`2px solid ${newMember.role === 'tech' ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, cursor:'pointer', color:'#e5e7eb', fontSize:14, fontWeight:600}}>
                  <div style={{fontSize:24, marginBottom:8}}><FaWrench style={{marginRight:4}} /></div>
                  Technician
                </button>
                <button type="button" onClick={() => setNewMember({...newMember, role: 'manager'})} style={{padding:16, background:newMember.role === 'manager' ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.05)', border:`2px solid ${newMember.role === 'manager' ? '#e5332a' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, cursor:'pointer', color:'#e5e7eb', fontSize:14, fontWeight:600}}>
                  <div style={{fontSize:24, marginBottom:8}}><FaUserTie style={{marginRight:4}} /></div>
                  Manager
                </button>
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Employee # (Auto)</label>
              <input
                type="text"
                value={newMember.employeeNumber}
                readOnly
                placeholder="Generating..."
                style={{width:'100%', padding:'12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
              />
            </div>

            <div style={{marginBottom:16}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Full Name *</label>
              <input type="text" value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} placeholder="John Doe" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>

            <div style={{marginBottom:16}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Email *</label>
              <input type="email" value={newMember.email} onChange={(e) => setNewMember({...newMember, email: e.target.value})} placeholder="john@example.com" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>

            <div style={{marginBottom:16}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Phone *</label>
              <input type="tel" value={newMember.phone} onChange={(e) => setNewMember({...newMember, phone: e.target.value})} placeholder="(555) 123-4567" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>

            <div style={{marginBottom:24}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Password *</label>
              <input type="password" value={newMember.password} onChange={(e) => setNewMember({...newMember, password: e.target.value})} placeholder="--------" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>

            <div style={{display:'flex', gap:12}}>
              <button onClick={() => setShowAddModal(false)} style={{flex:1, padding:'12px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleAddMember} style={{flex:1, padding:'12px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                Add Member
              </button>
            </div>
            {formError && <div style={{marginTop:12, fontSize:13, color:'#f87171', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px'}}>{formError}</div>}
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditModal && editingMember && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
          <div style={{background:'#000000', border:'1px solid rgba(255,255,255,0.2)', borderRadius:16, padding:32, maxWidth:500, width:'90%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>Edit Team Member</h2>
              <button onClick={() => setShowEditModal(false)} style={{background:'transparent', border:'none', color:'#9aa3b2', fontSize:24, cursor:'pointer', padding:0}}></button>
            </div>

            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Role *</label>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <button type="button" onClick={() => setEditingMember({...editingMember, role: 'tech'})} style={{padding:16, background:editingMember.role === 'tech' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', border:`2px solid ${editingMember.role === 'tech' ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, cursor:'pointer', color:'#e5e7eb', fontSize:14, fontWeight:600}}>
                  <div style={{fontSize:24, marginBottom:8}}><FaWrench style={{marginRight:4}} /></div>
                  Technician
                </button>
                <button type="button" onClick={() => setEditingMember({...editingMember, role: 'manager'})} style={{padding:16, background:editingMember.role === 'manager' ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.05)', border:`2px solid ${editingMember.role === 'manager' ? '#e5332a' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, cursor:'pointer', color:'#e5e7eb', fontSize:14, fontWeight:600}}>
                  <div style={{fontSize:24, marginBottom:8}}><FaUserTie style={{marginRight:4}} /></div>
                  Manager
                </button>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>First Name *</label>
                <input type="text" value={editingMember.firstName} onChange={(e) => setEditingMember({...editingMember, firstName: e.target.value})} placeholder="John" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
              </div>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Last Name *</label>
                <input type="text" value={editingMember.lastName} onChange={(e) => setEditingMember({...editingMember, lastName: e.target.value})} placeholder="Doe" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Email *</label>
              <input type="email" value={editingMember.email} onChange={(e) => setEditingMember({...editingMember, email: e.target.value})} placeholder="john@example.com" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>

            <div style={{marginBottom:16}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Phone *</label>
              <input type="tel" value={editingMember.phone} onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})} placeholder="(555) 123-4567" style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
            </div>

            <div style={{marginBottom:24}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Hourly Rate ($) *</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={editingMember.hourlyRate} 
                onChange={(e) => setEditingMember({...editingMember, hourlyRate: e.target.value})} 
                placeholder="25.00" 
                style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} 
              />
            </div>

            <div style={{display:'flex', gap:12}}>
              <button onClick={() => setShowEditModal(false)} style={{flex:1, padding:'12px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleUpdateMember} style={{flex:1, padding:'12px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                Update Member
              </button>
            </div>
            {editError && <div style={{marginTop:12, fontSize:13, color:'#f87171', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px'}}>{editError}</div>}
          </div>
        </div>
      )}
          </div>
        </div>
      </div>

      {/* Remove confirmation modal */}
      {removeConfirmId && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100}}>
          <div style={{background:'#1f2937', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:28, width:380, maxWidth:'90%'}}>
            <h3 style={{margin:'0 0 12px', fontSize:18, color:'#e5e7eb'}}>Remove Team Member</h3>
            <p style={{color:'#9ca3af', fontSize:14, marginBottom:20}}>Are you sure you want to remove this team member? This action cannot be undone.</p>
            <div style={{display:'flex', gap:10}}>
              <button onClick={() => handleRemoveMember(removeConfirmId)} style={{flex:1, background:'#e5332a', color:'#fff', border:'none', borderRadius:8, padding:'11px 0', fontSize:14, fontWeight:600, cursor:'pointer'}}>Remove</button>
              <button onClick={() => setRemoveConfirmId(null)} style={{flex:1, background:'transparent', color:'#9ca3af', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'11px 0', fontSize:14, cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{position:'fixed', bottom:24, right:24, background: toast.type === 'success' ? '#22c55e' : '#e5332a', color:'#fff', padding:'12px 20px', borderRadius:10, fontSize:14, fontWeight:600, zIndex:2000, boxShadow:'0 4px 20px rgba(0,0,0,0.4)'}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

