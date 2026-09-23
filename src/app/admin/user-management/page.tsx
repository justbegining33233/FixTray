'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBuilding, FaEnvelope, FaHourglassHalf, FaUsers } from 'react-icons/fa';

type User = {
  id: string;
  userType: 'admin' | 'shop' | 'customer' | 'tech' | 'manager';
  username?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  role: 'admin' | 'shop' | 'customer' | 'tech' | 'manager';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  activityStatus?: 'active' | 'inactive';
  hasActiveSession?: boolean;
  joinedDate: Date;
  lastLogin: Date | null;
  organization?: string;
  capabilities: {
    canEditRole: boolean;
    canEditStatus: boolean;
    canEditUsername: boolean;
  };
};

export default function UserManagement() {
  const say = usePhrase();
  const { user, isLoading } = useRequireAuth(['admin']);
  const [users, setUsers] = useState<User[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', role: 'customer', status: 'active' });
  const [modalMode, setModalMode] = useState<'edit' | 'reset' | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    if (!user || isLoading) return;

    // Fetch all users
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data?.users || [];
        const formattedUsers = list.map((u: any) => ({
          id: u.id,
          userType: u.userType || (u.role === 'technician' ? 'tech' : u.role) || 'customer',
          username: u.username,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || u.email || 'Unknown User',
          email: u.email || '',
          role: (u.role === 'technician' ? 'tech' : u.role) || 'customer',
          status: u.status || 'active',
          activityStatus: u.activityStatus || ((u.status === 'active' || u.status === 'approved') ? 'active' : 'inactive'),
          hasActiveSession: Boolean(u.hasActiveSession),
          joinedDate: new Date(u.joinedDate || u.createdAt || Date.now()),
          lastLogin: u.lastLogin ? new Date(u.lastLogin) : null,
          organization: u.shopName || '',
          capabilities: u.capabilities || { canEditRole: false, canEditStatus: false, canEditUsername: false },
        }));
        setUsers(formattedUsers);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching users:', err);
        setLoading(false);
      });
  }, [user, isLoading]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#e5332a';
      case 'shop': return '#22c55e';
      case 'manager': return '#e5332a';
      case 'tech': return '#8b5cf6';
      case 'customer': return '#f59e0b';
      default: return '#9aa3b2';
    }
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setEditForm({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      role: u.role,
      status: u.status,
    });
    setModalMode('edit');
  };

  const openResetModal = (u: User) => {
    setSelectedUser(u);
    setNewPassword('');
    setModalMode('reset');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setNewPassword('');
  };

  const updateUserStatus = async (targetUser: User, nextStatus: User['status']) => {
    if (!targetUser.capabilities.canEditStatus) return;

    setSavingAction(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: targetUser.id,
          userType: targetUser.userType,
          status: nextStatus,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Failed to update status');
        return;
      }

      setUsers((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, status: nextStatus } : item));
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser) return;
    setSavingAction(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: selectedUser.id,
          userType: selectedUser.userType,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          ...(selectedUser.capabilities.canEditRole ? { role: editForm.role } : {}),
          ...(selectedUser.capabilities.canEditStatus ? { status: editForm.status } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Failed to update user');
        return;
      }

      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? {
        ...u,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        name: `${editForm.firstName} ${editForm.lastName}`.trim() || u.name,
        email: editForm.email,
        role: selectedUser.capabilities.canEditRole ? editForm.role as User['role'] : u.role,
        status: selectedUser.capabilities.canEditStatus ? editForm.status as User['status'] : u.status,
      } : u));
      closeModal();
    } finally {
      setSavingAction(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    setSavingAction(true);
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedUser.id,
          userType: selectedUser.userType,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Failed to reset password');
        return;
      }
      alert('Password reset successfully.');
      closeModal();
    } finally {
      setSavingAction(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'inactive': return '#64748b';
      case 'pending': return '#f59e0b';
      case 'suspended': return '#e5332a';
      default: return '#9aa3b2';
    }
  };

  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

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
        {say("Loading...")}{' '}</div>
    );
  }

  // If no user, the useRequireAuth hook will handle redirect
  if (!user) {
    return null;
  }

  let filteredUsers = users;
  if (filterRole !== 'all') filteredUsers = filteredUsers.filter(u => u.role === filterRole);
  if (filterStatus !== 'all') {
    filteredUsers = filteredUsers.filter(u => {
      if (filterStatus === 'active' || filterStatus === 'inactive') {
        return (u.activityStatus || 'inactive') === filterStatus;
      }
      return u.status === filterStatus;
    });
  }

  const userStats = {
    total: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    shop: users.filter(u => u.role === 'shop').length,
    manager: users.filter(u => u.role === 'manager').length,
    technician: users.filter(u => u.role === 'tech').length,
    customer: users.filter(u => u.role === 'customer').length,
    active: users.filter(u => (u.activityStatus || 'inactive') === 'active').length,
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(168,85,247,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/admin/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> {say("Back to Dashboard")}{' '}</Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaUsers style={{marginRight:4}} /> {say("User Management")}</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>{say("Manage all platform users and roles")}</p>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Stats Overview */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:16, marginBottom:24}}>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:16}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>{say("Total Users")}</div>
            <div style={{fontSize:24, fontWeight:700, color:'#e5332a'}}>{say(userStats.total)}</div>
          </div>
          <div style={{background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:16}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>{say("Admins")}</div>
            <div style={{fontSize:24, fontWeight:700, color:'#e5332a'}}>{say(userStats.admin)}</div>
          </div>
          <div style={{background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:16}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>{say("Shops")}</div>
            <div style={{fontSize:24, fontWeight:700, color:'#22c55e'}}>{say(userStats.shop)}</div>
          </div>
          <div style={{background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:12, padding:16}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>{say("Technicians")}</div>
            <div style={{fontSize:24, fontWeight:700, color:'#8b5cf6'}}>{say(userStats.technician)}</div>
          </div>
          <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:16}}>
            <div style={{fontSize:11, color:'#9aa3b2', marginBottom:4}}>{say("Customers")}</div>
            <div style={{fontSize:24, fontWeight:700, color:'#f59e0b'}}>{say(userStats.customer)}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{display:'flex', gap:16, marginBottom:24}}>
          <div>
            <label style={{display:'block', fontSize:12, color:'#9aa3b2', marginBottom:8, fontWeight:600}}>{say("Filter by Role")}</label>
            <select 
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{padding:'10px 16px', background:'rgba(0,0,0,0.3)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', minWidth:150}}
            >
              <option value="all">{say("All Roles")}</option>
              <option value="admin">{say("Admin")}</option>
              <option value="shop">{say("Shop")}</option>
              <option value="manager">{say("Manager")}</option>
              <option value="tech">{say("Technician")}</option>
              <option value="customer">{say("Customer")}</option>
            </select>
          </div>
          <div>
            <label style={{display:'block', fontSize:12, color:'#9aa3b2', marginBottom:8, fontWeight:600}}>{say("Filter by Status")}</label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{padding:'10px 16px', background:'rgba(0,0,0,0.3)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', minWidth:150}}
            >
              <option value="all">{say("All Status")}</option>
              <option value="active">{say("Active")}</option>
              <option value="inactive">{say("Inactive")}</option>
              <option value="pending">{say("Pending")}</option>
              <option value="suspended">{say("Suspended")}</option>
            </select>
          </div>
        </div>

        {/* User List */}
        {loading ? (
          <div style={{textAlign:'center', padding:60, color:'#9aa3b2'}}>
            <div style={{fontSize:48, marginBottom:16}}><FaHourglassHalf style={{marginRight:4}} /></div>
            <div>{say("Loading users...")}</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{textAlign:'center', padding:60, color:'#9aa3b2'}}>
            <div style={{fontSize:48, marginBottom:16}}><FaUsers style={{marginRight:4}} /></div>
            <div>{say("No users found")}</div>
          </div>
        ) : (
          <div style={{display:'grid', gap:16}}>
            {filteredUsers.map((user) => (
              <div key={user.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:20}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
                    <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>{say(user.name)}</h3>
                    <span style={{padding:'4px 12px', background:`${getRoleColor(user.role)}20`, color:getRoleColor(user.role), borderRadius:8, fontSize:11, fontWeight:600}}>
                      {user.role.toUpperCase()}
                    </span>
                    <span style={{padding:'4px 12px', background:`${getStatusColor(user.status)}20`, color:getStatusColor(user.status), borderRadius:8, fontSize:11, fontWeight:600}}>
                      {say("ACCOUNT:")}{' '}{user.status.toUpperCase()}
                    </span>
                    <span style={{padding:'4px 12px', background:`${getStatusColor((user.activityStatus || 'inactive') as string)}20`, color:getStatusColor((user.activityStatus || 'inactive') as string), borderRadius:8, fontSize:11, fontWeight:600}}>
                      {say("ACTIVITY:")}{' '}{(user.activityStatus || 'inactive').toUpperCase()}{user.hasActiveSession ? say(" (SESSION)") : ''}
                    </span>
                  </div>
                  <div style={{fontSize:14, color:'#9aa3b2', marginBottom:4}}><FaEnvelope style={{marginRight:4}} /> {say(user.email)}</div>
                  {user.organization && (
                    <div style={{fontSize:13, color:'#6b7280'}}><FaBuilding style={{marginRight:4}} /> {say(user.organization)}</div>
                  )}
                  <div style={{fontSize:12, color:'#6b7280', marginTop:8}}>
                    {say("Joined:")}{' '}{user.joinedDate.toLocaleDateString()} {say("- Last login:")}{' '}{getTimeAgo(user.lastLogin)}
                  </div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button
                    onClick={() => openEditModal(user)}
                    style={{padding:'10px 16px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer'}}
                  >
                    {say("Edit")}{' '}</button>
                  <button
                    onClick={() => openResetModal(user)}
                    style={{padding:'10px 16px', background:'rgba(139,92,246,0.2)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.35)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer'}}
                  >
                    {say("Reset Password")}{' '}</button>
                  {user.capabilities.canEditStatus ? (
                    user.status === 'active' ? (
                      <button
                        onClick={() => updateUserStatus(user, 'suspended')}
                        disabled={savingAction}
                        style={{padding:'10px 16px', background:'rgba(229,51,42,0.2)', color:'#e5332a', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity: savingAction ? 0.7 : 1}}
                      >
                        {say("Suspend")}{' '}</button>
                    ) : (
                      <button
                        onClick={() => updateUserStatus(user, 'active')}
                        disabled={savingAction}
                        style={{padding:'10px 16px', background:'rgba(34,197,94,0.2)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity: savingAction ? 0.7 : 1}}
                      >
                        {say("Activate")}{' '}</button>
                    )
                  ) : (
                    <div style={{padding:'10px 16px', background:'rgba(100,116,139,0.15)', color:'#94a3b8', border:'1px solid rgba(100,116,139,0.3)', borderRadius:8, fontSize:12, fontWeight:600}}>
                      {say("Status read-only")}{' '}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {modalMode && selectedUser && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
          <div style={{width:'100%', maxWidth:540, background:'#0b1220', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:20}}>
            <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:12}}>
              {modalMode === 'edit' ? say("Quick Edit User") : say("Reset User Password")}
            </h3>
            {modalMode === 'edit' ? (
              <div style={{display:'grid', gap:12}}>
                <input value={editForm.firstName} onChange={(e) => setEditForm((p) => ({...p, firstName: e.target.value}))} placeholder={say("First name")} style={{padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.04)', color:'#e5e7eb'}} />
                <input value={editForm.lastName} onChange={(e) => setEditForm((p) => ({...p, lastName: e.target.value}))} placeholder={say("Last name")} style={{padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.04)', color:'#e5e7eb'}} />
                <input value={editForm.email} onChange={(e) => setEditForm((p) => ({...p, email: e.target.value}))} placeholder={say("Email")} style={{padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.04)', color:'#e5e7eb'}} />
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <select value={editForm.role} onChange={(e) => setEditForm((p) => ({...p, role: e.target.value}))} disabled={!selectedUser.capabilities.canEditRole} style={{padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.18)', background:selectedUser.capabilities.canEditRole ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.8)', color:'#e5e7eb', opacity: selectedUser.capabilities.canEditRole ? 1 : 0.7}}>
                    <option value="admin">{say("Admin")}</option>
                    <option value="shop">{say("Shop")}</option>
                    <option value="manager">{say("Manager")}</option>
                    <option value="tech">{say("Tech")}</option>
                    <option value="customer">{say("Customer")}</option>
                  </select>
                  <select value={editForm.status} onChange={(e) => setEditForm((p) => ({...p, status: e.target.value}))} disabled={!selectedUser.capabilities.canEditStatus} style={{padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.18)', background:selectedUser.capabilities.canEditStatus ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.8)', color:'#e5e7eb', opacity: selectedUser.capabilities.canEditStatus ? 1 : 0.7}}>
                    <option value="active">{say("Active")}</option>
                    <option value="inactive">{say("Inactive")}</option>
                    <option value="pending">{say("Pending")}</option>
                    <option value="suspended">{say("Suspended")}</option>
                  </select>
                </div>
                <p style={{fontSize:12, color:'#94a3b8', margin:0}}>
                  {say("Only fields backed by the selected user type are editable. Shop accounts support persisted status changes.")}{' '}</p>
              </div>
            ) : (
              <div style={{display:'grid', gap:12}}>
                <p style={{fontSize:13, color:'#9aa3b2'}}>{say("Reset password for")}{' '}<strong style={{color:'#e5e7eb'}}>{say(selectedUser.name)}</strong> ({say(selectedUser.email)})</p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={say("New password (min 8 chars)")}
                  style={{padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.04)', color:'#e5e7eb'}}
                />
              </div>
            )}

            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:16}}>
              <button onClick={closeModal} style={{padding:'10px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.18)', background:'transparent', color:'#9aa3b2', cursor:'pointer'}}>{say("Cancel")}</button>
              <button
                onClick={modalMode === 'edit' ? handleSaveUserEdit : handleResetPassword}
                disabled={savingAction}
                style={{padding:'10px 14px', borderRadius:8, border:'none', background:'#e5332a', color:'white', cursor:'pointer', opacity: savingAction ? 0.7 : 1}}
              >
                {savingAction ? say("Saving...") : modalMode === 'edit' ? say("Save User") : say("Reset Password")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

