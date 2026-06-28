'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';

import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaBuilding, FaSearch, FaCar } from 'react-icons/fa';

type CustomerVehicle = {
  id: string;
  vehicleType: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
};

type CustomerResult = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  vehicles: CustomerVehicle[];
};

export default function ShopNewInShopJob() {
  const router = useRouter();
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'tech']);
  const [userName, setUserName] = useState('');
  const [serviceOptions, setServiceOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);

  // Search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vin: '',
    mileage: '',
    serviceType: '',
    services: [] as string[],
    appointmentDate: '',
    appointmentTime: '',
    estimatedHours: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.name) setUserName(user.name);
  }, [user]);

  // Load services for this shop
  useEffect(() => {
    const loadServices = async () => {
      if (!user) return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;
      const shopId = user.shopId || user.id;
      try {
        const res = await fetch(`/api/services?shopId=${encodeURIComponent(shopId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const services = Array.isArray(data?.services) ? data.services : [];
          const uniqueNames: string[] = Array.from(
            new Set<string>(
              services
                .map((svc: any) => String(svc?.serviceName || '').trim())
                .filter((name: string) => name.length > 0)
            )
          );
          setServiceOptions(uniqueNames.map((name) => ({ value: name, label: name })));
        }
      } finally {
        setServicesLoaded(true);
      }
    };
    loadServices();
  }, [user]);

  // Debounced customer search — hits the real DB
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (customerSearch.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const shopId = user?.shopId || user?.id || '';
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(customerSearch.trim())}&shopId=${encodeURIComponent(shopId)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.customers || []);
          setShowDropdown(true);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [customerSearch, user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    if (serviceOptions.length === 0) {
      console.error('Cannot create in-shop work order without configured shop services');
      return;
    }
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

  // Apply a customer from search results — if they have 1 vehicle auto-fill, otherwise open picker
  const applyCustomer = (customer: CustomerResult) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      customerPhone: customer.phone || '',
      customerEmail: customer.email || '',
    }));
    setCustomerSearch(`${customer.firstName} ${customer.lastName}`.trim());
    setShowDropdown(false);

    if (customer.vehicles.length === 1) {
      applyVehicle(customer.vehicles[0]);
    } else if (customer.vehicles.length > 1) {
      setVehiclePickerOpen(true);
    }
  };

  const applyVehicle = (v: CustomerVehicle) => {
    setFormData(prev => ({
      ...prev,
      vehicleMake:  v.make  || prev.vehicleMake,
      vehicleModel: v.model || prev.vehicleModel,
      vehicleYear:  v.year  ? String(v.year) : prev.vehicleYear,
      vin:          v.vin   || prev.vin,
    }));
    setVehiclePickerOpen(false);
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

            {/* Recurring Customer / Fleet Search */}
            <div ref={searchBoxRef} style={{ marginBottom: 20, position: 'relative' }}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8, fontWeight:600}}>
                <FaSearch style={{marginRight:6, fontSize:11}} />Recurring Customer / Fleet Search
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  style={{
                    width: '100%', padding: '12px 12px 12px 40px',
                    background: 'rgba(0,0,0,0.4)',
                    border: selectedCustomer ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8, color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box',
                  }}
                  placeholder="Search by name, phone, email, VIN, plate…"
                  autoComplete="off"
                />
                <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 13, pointerEvents: 'none' }} />
                {searching && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9aa3b2' }}>Searching…</span>
                )}
              </div>

              {/* Results dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: '#111111', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyCustomer(c)}
                      style={{ width: '100%', textAlign: 'left', background: 'transparent', color: '#e5e7eb', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,51,42,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {c.firstName} {c.lastName}
                        {c.company && <span style={{ fontWeight: 400, color: '#9aa3b2', marginLeft: 8 }}>· {c.company}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#9aa3b2', marginTop: 2 }}>
                        {c.phone && <span style={{ marginRight: 10 }}>{c.phone}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                      {c.vehicles.length > 0 && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {c.vehicles.slice(0, 3).map(v => (
                            <span key={v.id} style={{ padding: '1px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                              <FaCar style={{ marginRight: 3, fontSize: 9 }} />
                              {[v.year, v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}
                              {v.licensePlate ? ` · ${v.licensePlate}` : ''}
                            </span>
                          ))}
                          {c.vehicles.length > 3 && <span style={{ color: '#6b7280' }}>+{c.vehicles.length - 3} more</span>}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && !searching && searchResults.length === 0 && customerSearch.trim().length >= 2 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>
                  No existing customers found — fill in the form below to create one.
                </div>
              )}
            </div>

            {/* Vehicle picker (multi-vehicle customers) */}
            {vehiclePickerOpen && selectedCustomer && selectedCustomer.vehicles.length > 1 && (
              <div style={{ marginBottom: 20, padding: 14, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 10 }}>
                  <FaCar style={{ marginRight: 6 }} />Select a vehicle for {selectedCustomer.firstName} {selectedCustomer.lastName}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedCustomer.vehicles.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => applyVehicle(v)}
                      style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#e5e7eb', cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    >
                      <strong>{[v.year, v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}</strong>
                      {v.vin && <span style={{ color: '#9aa3b2', marginLeft: 10, fontSize: 11 }}>VIN {v.vin}</span>}
                      {v.licensePlate && <span style={{ color: '#9aa3b2', marginLeft: 10, fontSize: 11 }}>Plate {v.licensePlate}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              {!servicesLoaded ? (
                <div style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', color: '#9aa3b2', fontSize: 13 }}>
                  Loading live shop services...
                </div>
              ) : serviceOptions.length === 0 ? (
                <div style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
                  No services are configured for this shop. Add services in Shop Services before creating work orders.
                </div>
              ) : (
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
                    {option.label}
                  </button>
                ))}
              </div>
              )}
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


