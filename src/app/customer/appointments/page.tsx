'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaCalendarAlt, FaComments, FaMapMarkerAlt } from 'react-icons/fa';

interface Appointment {
  id: string;
  scheduledDate: string;
  serviceType: string;
  status: string;
  notes?: string;
  shop: {
    id: string;
    shopName: string;
    phone: string;
    address: string;
  };
  vehicle?: {
    make: string;
    model: string;
    year: number;
  };
}

export default function CustomerAppointmentsPage() {
  useRequireAuth(['customer']);
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookForm, setShowBookForm] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [shopServiceOptions, setShopServiceOptions] = useState<string[]>([]);
  const [newAppointment, setNewAppointment] = useState({
    shopId: '',
    vehicleId: '',
    scheduledDate: '',
    serviceType: '',
    notes: ''
  });
  const [apptMsg, setApptMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [cancelApptId, setCancelApptId] = useState<string|null>(null);

  useEffect(() => {
    fetchAppointments();
    fetchShops();
    fetchVehicles();
  }, [router]);

  useEffect(() => {
    const selectedShop = shops.find((shop) => shop.id === newAppointment.shopId);

    if (!selectedShop) {
      setShopServiceOptions([]);
      setNewAppointment((prev) => ({ ...prev, serviceType: '' }));
      return;
    }

    const allServiceNames = [
      ...((selectedShop.dieselServices || []) as Array<{ serviceName?: string }>),
      ...((selectedShop.gasServices || []) as Array<{ serviceName?: string }>),
    ]
      .map((service) => (service?.serviceName || '').trim())
      .filter((serviceName) => serviceName.length > 0);

    const uniqueServiceNames = Array.from(new Set(allServiceNames));
    setShopServiceOptions(uniqueServiceNames);
    setNewAppointment((prev) => ({
      ...prev,
      serviceType: uniqueServiceNames.includes(prev.serviceType)
        ? prev.serviceType
        : (uniqueServiceNames[0] || ''),
    }));
  }, [newAppointment.shopId, shops]);

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments || []);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShops = async () => {
    try {
      const response = await fetch('/api/shops/accepted');
      if (response.ok) {
        const data = await response.json();
        setShops(data);
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/customers/vehicles', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  // Message modal state and handlers for appointments
  const [messageModal, setMessageModal] = useState<{ isOpen: boolean; appointment: Appointment | null; message: string; sending: boolean }>({
    isOpen: false,
    appointment: null,
    message: '',
    sending: false,
  });

  const openMessageModal = (appointment: Appointment) => {
    setMessageModal({ isOpen: true, appointment, message: '', sending: false });
  };

  const closeMessageModal = () => {
    setMessageModal({ isOpen: false, appointment: null, message: '', sending: false });
  };

  const sendMessage = async () => {
    if (!messageModal.appointment || !messageModal.message.trim()) return;
    setMessageModal(prev => ({ ...prev, sending: true }));

    try {
      const token = localStorage.getItem('token');
      const appt = messageModal.appointment;
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          receiverId: appt.shop.id,
          receiverRole: 'shop',
          receiverName: appt.shop.shopName,
          messageBody: messageModal.message.trim(),
        }),
      });

      if (response.ok) {
        setApptMsg({type:'success',text:'Message sent successfully!'});
        closeMessageModal();
      } else {
        setApptMsg({type:'error',text:'Failed to send message. Please try again.'});
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setApptMsg({type:'error',text:'Failed to send message. Please try again.'});
    } finally {
      setMessageModal(prev => ({ ...prev, sending: false }));
    }
  };

  const handleBookAppointment = async () => {
    if (!newAppointment.shopId || !newAppointment.scheduledDate || !newAppointment.serviceType) {
      setApptMsg({type:'error',text:'Please select a shop, service, and date/time'});
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newAppointment,
          vehicleId: newAppointment.vehicleId || undefined,
        }),
      });

      if (response.ok) {
        setApptMsg({type:'success',text:'Appointment booked successfully!'});
        setShowBookForm(false);
        setNewAppointment({ shopId: '', vehicleId: '', scheduledDate: '', serviceType: '', notes: '' });
        fetchAppointments();
      } else {
        const error = await response.json();
        setApptMsg({type:'error',text:error.error || 'Failed to book appointment'});
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      setApptMsg({type:'error',text:'Failed to book appointment'});
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setApptMsg({type:'success',text:'Appointment cancelled'});
        fetchAppointments();
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
    } finally {
      setCancelApptId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e5e7eb', fontSize: 20 }}>Loading appointments...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: 'transparent' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Link href="/customer/home" style={{ color: '#e5332a', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}><FaCalendarAlt style={{marginRight:4}} /> My Appointments</h1>
              <p style={{ fontSize: 14, color: '#9aa3b2' }}>Book and manage your service appointments</p>
            </div>
            <button
              onClick={() => router.push('/customer/appointments/new' as Route)}
              style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #e5332a 0%, #c62822 100%)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              + Book Appointment
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        {/* Appointments List */}
        <div style={{ display: 'grid', gap: 16 }}>
          {appointments.length === 0 ? (
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}><FaCalendarAlt style={{marginRight:4}} /></div>
              <h3 style={{ color: '#e5e7eb', fontSize: 20, marginBottom: 8 }}>No Appointments Yet</h3>
              <p style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 20 }}>Book your first appointment to get started</p>
              <button
                onClick={() => router.push('/customer/appointments/new' as Route)}
                style={{ padding: '12px 24px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Book Appointment
              </button>
            </div>
          ) : (
            appointments.map((apt) => (
              <div key={apt.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{apt.shop.shopName}</h3>
                    <div style={{ color: '#9aa3b2', fontSize: 14 }}>{apt.shop.address}</div>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    background: apt.status === 'completed' ? 'rgba(16,185,129,0.2)' : apt.status === 'confirmed' ? 'rgba(229,51,42,0.2)' : apt.status === 'cancelled' ? 'rgba(229,51,42,0.2)' : 'rgba(245,158,11,0.2)',
                    color: apt.status === 'completed' ? '#10b981' : apt.status === 'confirmed' ? '#ff6b64' : apt.status === 'cancelled' ? '#e5332a' : '#f59e0b',
                    height: 'fit-content'
                  }}>
                    {apt.status.toUpperCase()}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ color: '#9aa3b2', fontSize: 12, marginBottom: 4 }}>Date & Time</div>
                    <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>
                      {new Date(apt.scheduledDate).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#9aa3b2', fontSize: 12, marginBottom: 4 }}>Service Type</div>
                    <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>
                      {apt.serviceType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </div>
                  </div>
                </div>

                {apt.vehicle && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: '#9aa3b2', fontSize: 12, marginBottom: 4 }}>Vehicle</div>
                    <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>
                      {apt.vehicle.year} {apt.vehicle.make} {apt.vehicle.model}
                    </div>
                  </div>
                )}

                {apt.notes && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: '#9aa3b2', fontSize: 12, marginBottom: 4 }}>Notes</div>
                    <div style={{ color: '#e5e7eb', fontSize: 14 }}>{apt.notes}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Track button - goes to shop page */}
                  <Link href={`/customer/shop/${apt.shop.id}`} style={{ flex: 1, padding: '10px', background: 'rgba(229,51,42,0.2)', color: '#ff6b64', border: '1px solid rgba(229,51,42,0.3)', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'inline-block' }}>
                    <FaMapMarkerAlt style={{marginRight:4}} /> Track
                  </Link>

                  {/* Message button - opens modal for this appointment */}
                  <button
                    onClick={() => openMessageModal(apt)}
                    style={{ flex: 1, padding: '10px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <FaComments style={{marginRight:4}} /> Message
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Book Appointment Modal */}
      {showBookForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#2a2a2a', borderRadius: 12, padding: 32, maxWidth: 500, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#e5e7eb', fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Book Appointment</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 8, display: 'block' }}>Select Shop *</label>
                <select
                  value={newAppointment.shopId}
                  onChange={(e) => setNewAppointment({ ...newAppointment, shopId: e.target.value })}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                >
                  <option value="">Choose a shop...</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>{shop.shopName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 8, display: 'block' }}>Date & Time *</label>
                <input
                  type="datetime-local"
                  value={newAppointment.scheduledDate}
                  onChange={(e) => setNewAppointment({ ...newAppointment, scheduledDate: e.target.value })}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 8, display: 'block' }}>Service Type *</label>
                <select
                  value={newAppointment.serviceType}
                  onChange={(e) => setNewAppointment({ ...newAppointment, serviceType: e.target.value })}
                  disabled={!newAppointment.shopId || shopServiceOptions.length === 0}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                >
                  {!newAppointment.shopId && <option value="">Select a shop first</option>}
                  {newAppointment.shopId && shopServiceOptions.length === 0 && <option value="">No services configured for this shop</option>}
                  {shopServiceOptions.map((serviceName) => (
                    <option key={serviceName} value={serviceName}>{serviceName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 8, display: 'block' }}>Vehicle (Optional)</label>
                <select
                  value={newAppointment.vehicleId}
                  onChange={(e) => setNewAppointment({ ...newAppointment, vehicleId: e.target.value })}
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                >
                  <option value="">No vehicle selected</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ color: '#9aa3b2', fontSize: 14, marginBottom: 8, display: 'block' }}>Notes (Optional)</label>
                <textarea
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  placeholder="Any special requests or details..."
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', minHeight: 80, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button
                  onClick={handleBookAppointment}
                  style={{ flex: 1, padding: 12, background: 'linear-gradient(135deg, #e5332a 0%, #c62822 100%)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirm Booking
                </button>
                <button
                  onClick={() => {
                    setShowBookForm(false);
                    setNewAppointment({ shopId: '', vehicleId: '', scheduledDate: '', serviceType: '', notes: '' });
                  }}
                  style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.1)', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal for appointments */}
      {messageModal.isOpen && messageModal.appointment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: 24, maxWidth: 500, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 16}}>Message Shop</h3>
            <div style={{fontSize: 14, color: '#9aa3b2', marginBottom: 16}}>
              Appointment: {messageModal.appointment.scheduledDate}
              <div>Shop: {messageModal.appointment.shop.shopName}</div>
            </div>
            <textarea
              value={messageModal.message}
              onChange={(e) => setMessageModal(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Type your message here..."
              style={{ width: '100%', minHeight: 120, padding: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e5e7eb', fontSize: 14, resize: 'vertical', marginBottom: 16 }}
            />
            <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
              <button onClick={closeMessageModal} style={{ padding: '8px 16px', background: 'transparent', color: '#9aa3b2', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={sendMessage} disabled={!messageModal.message.trim() || messageModal.sending} style={{ padding: '8px 16px', background: '#a855f7', color: 'white', border: 'none', borderRadius: 6, cursor: messageModal.message.trim() && !messageModal.sending ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, opacity: messageModal.message.trim() && !messageModal.sending ? 1 : 0.5 }}>{messageModal.sending ? 'Sending...' : 'Send Message'}</button>
            </div>
          </div>
        </div>
      )}

      {apptMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:apptMsg.type==='success'?'#dcfce7':'#fde8e8',color:apptMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {apptMsg.text}
          <button onClick={()=>setApptMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}

      {cancelApptId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#2a2a2a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:32,maxWidth:400,width:'90%'}}>
            <h3 style={{color:'#e5e7eb',fontSize:18,fontWeight:700,marginBottom:12}}>Cancel Appointment?</h3>
            <p style={{color:'#9aa3b2',fontSize:14,marginBottom:24}}>Are you sure you want to cancel this appointment?</p>
            <div style={{display:'flex',gap:12}}>
              <button onClick={()=>handleCancelAppointment(cancelApptId)} style={{flex:1,padding:'11px 0',background:'#e5332a',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Yes, Cancel</button>
              <button onClick={()=>setCancelApptId(null)} style={{flex:1,padding:'11px 0',background:'rgba(255,255,255,0.1)',color:'#9aa3b2',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}}>Keep It</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
