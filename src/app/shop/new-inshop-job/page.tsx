'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';

import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBuilding } from 'react-icons/fa';

export default function ShopNewInShopJob() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['shop', 'tech']);
  const [userName, setUserName] = useState('');
  const [serviceOptions, setServiceOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'oil-change', label: 'Oil Change' },
    { value: 'brake-service', label: 'Brake Service' },
    { value: 'tire-rotation', label: 'Tire Rotation' },
    { value: 'engine-diagnostic', label: 'Engine Diagnostic' },
    { value: 'transmission-service', label: 'Transmission Service' },
    { value: 'electrical-repair', label: 'Electrical Repair' },
    { value: 'air-conditioning', label: 'A/C Service' },
    { value: 'suspension', label: 'Suspension Repair' },
  ]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vin: '',
    mileage: '',
    serviceType: 'maintenance',
    services: [] as string[],
    appointmentDate: '',
    appointmentTime: '',
    estimatedHours: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.name) setUserName(user.name);
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;

      const shopId = user.shopId || user.id;

      try {
        const [servicesRes, workOrdersRes] = await Promise.all([
          fetch(`/api/services?shopId=${encodeURIComponent(shopId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/workorders?limit=100', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (servicesRes.ok) {
          const data = await servicesRes.json();
          const services = Array.isArray(data?.services) ? data.services : [];
          if (services.length > 0) {
            setServiceOptions(
              services.map((svc: any) => ({
                value: String(svc.id),
                label: String(svc.serviceName || 'Service'),
              }))
            );
          }
        }

        if (workOrdersRes.ok) {
          const data = await workOrdersRes.json();
          const items = Array.isArray(data?.workOrders) ? data.workOrders : [];
          setCustomerSuggestions(items);
        }
      } catch {
        // Keep default behavior if fetch fails.
      }
    };

    loadData();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch('/api/workorders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          shopId: user.shopId || user.id,
          vehicleType: 'personal-vehicle',
          serviceLocationType: 'in-shop',
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          customerEmail: formData.customerEmail,
          vehicleMake: formData.vehicleMake,
          vehicleModel: formData.vehicleModel,
          vehicleYear: formData.vehicleYear,
          vin: formData.vin,
          mileage: formData.mileage,
          services: {
            repairs: [],
            maintenance: formData.services,
          },
          issueDescription: formData.notes || `In-shop job created for ${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}`,
          appointmentDate: formData.appointmentDate,
          appointmentTime: formData.appointmentTime,
          estimatedHours: parseFloat(formData.estimatedHours) || 0,
          notes: formData.notes,
          status: 'pending',
          createdBy: formData.customerName || userName,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to create work order', err);
        return;
      }
      router.push('/shop/home' as Route);
    } catch (err) {
      console.error('Error creating work order', err);
    }
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const filteredSuggestions = customerSearch.trim().length < 2
    ? []
    : customerSuggestions
      .filter((wo) => {
        const q = customerSearch.toLowerCase();
        const fullName = `${wo?.customer?.firstName || ''} ${wo?.customer?.lastName || ''}`.toLowerCase();
        const email = String(wo?.customer?.email || '').toLowerCase();
        const phone = String(wo?.customer?.phone || '').toLowerCase();
        const make = String(wo?.vehicle?.make || '').toLowerCase();
        const model = String(wo?.vehicle?.model || '').toLowerCase();
        const vin = String(wo?.vehicle?.vin || '').toLowerCase();
        const plate = String(wo?.vehicle?.licensePlate || '').toLowerCase();
        const fleet = String(wo?.customer?.fleetAccountName || '').toLowerCase();
        return [fullName, email, phone, make, model, vin, plate, fleet].some((v) => v.includes(q));
      })
      .slice(0, 8);

  const applySuggestion = (wo: any) => {
    setFormData((prev) => ({
      ...prev,
      customerName: `${wo?.customer?.firstName || ''} ${wo?.customer?.lastName || ''}`.trim(),
      customerPhone: wo?.customer?.phone || '',
      customerEmail: wo?.customer?.email || '',
      vehicleMake: wo?.vehicle?.make || prev.vehicleMake,
      vehicleModel: wo?.vehicle?.model || prev.vehicleModel,
      vehicleYear: wo?.vehicle?.year ? String(wo.vehicle.year) : prev.vehicleYear,
      vin: wo?.vehicle?.vin || prev.vin,
    }));
    setCustomerSearch('');
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1200, margin:'0 auto'}}>
          <Link href="/shop/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaBuilding style={{marginRight:4}} /> New In-Shop Job</h1>
          <p style={{fontSize:14, color:'#9aa3b2'}}>Create a new in-shop service work order</p>
        </div>
      </div>

      <div style={{maxWidth:900, margin:'0 auto', padding:32}}>
        <form onSubmit={handleSubmit}>
          {/* Customer Information */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginBottom:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Customer Information</h2>
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Recurring Customer / Fleet Search</label>
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                placeholder="Search by name, phone, email, VIN, or license plate"
              />
              {filteredSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: '#000000', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, overflow: 'hidden' }}>
                  {filteredSuggestions.map((wo) => (
                    <button
                      key={wo.id}
                      type="button"
                      onClick={() => applySuggestion(wo)}
                      style={{ width: '100%', textAlign: 'left', background: 'transparent', color: '#e5e7eb', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px', cursor: 'pointer' }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{`${wo?.customer?.firstName || ''} ${wo?.customer?.lastName || ''}`.trim() || 'Customer'}</div>
                      <div style={{ fontSize: 12, color: '#9aa3b2' }}>
                        {wo?.vehicle?.year ? `${wo.vehicle.year} ` : ''}{wo?.vehicle?.make || ''} {wo?.vehicle?.model || ''}
                        {wo?.vehicle?.licensePlate ? `  Plate ${wo.vehicle.licensePlate}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Customer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div style={{gridColumn:'1 / -1'}}>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Email</label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="customer@email.com"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginBottom:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Vehicle Information</h2>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16}}>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Year *</label>
                <input
                  type="text"
                  required
                  value={formData.vehicleYear}
                  onChange={(e) => setFormData({...formData, vehicleYear: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="2020"
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Make *</label>
                <input
                  type="text"
                  required
                  value={formData.vehicleMake}
                  onChange={(e) => setFormData({...formData, vehicleMake: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="Ford"
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Model *</label>
                <input
                  type="text"
                  required
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData({...formData, vehicleModel: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="F-150"
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>VIN</label>
                <input
                  type="text"
                  value={formData.vin}
                  onChange={(e) => setFormData({...formData, vin: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="1FTFW1E84MFA12345"
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Mileage</label>
                <input
                  type="text"
                  value={formData.mileage}
                  onChange={(e) => setFormData({...formData, mileage: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                  placeholder="45000"
                />
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginBottom:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Service Details</h2>
            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:12}}>Select Services *</label>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12}}>
                {serviceOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleService(option.value)}
                    style={{
                      padding:'12px 16px',
                      background: formData.services.includes(option.value) ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                      color: formData.services.includes(option.value) ? '#22c55e' : '#9aa3b2',
                      border: `1px solid ${formData.services.includes(option.value) ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius:8,
                      fontSize:13,
                      fontWeight:600,
                      cursor:'pointer',
                      textAlign:'left'
                    }}
                  >
                    {formData.services.includes(option.value) ? '<FaCheck style={{marginRight:4}} /> ' : ''}{option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20}}>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Appointment Date</label>
                <input
                  type="date"
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({...formData, appointmentDate: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                />
              </div>
              <div>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Appointment Time</label>
                <input
                  type="time"
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({...formData, appointmentTime: e.target.value})}
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                />
              </div>
            </div>

            <div>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Estimated Hours</label>
              <input
                type="text"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({...formData, estimatedHours: e.target.value})}
                style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                placeholder="2.5"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginBottom:24}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:20}}>Additional Notes</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={6}
              style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14, resize:'vertical'}}
              placeholder="Enter any additional information about the service..."
            />
          </div>

          {/* Submit Button */}
          <div style={{display:'flex', gap:12}}>
            <Link href="/shop/home" style={{flex:1}}>
              <button type="button" style={{width:'100%', padding:'16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:16, fontWeight:600, cursor:'pointer'}}>
                Cancel
              </button>
            </Link>
            <button type="submit" style={{flex:1, padding:'16px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:16, fontWeight:600, cursor:'pointer'}}>
              Create In-Shop Job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


