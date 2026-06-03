"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaCamera,
  FaCar,
  FaCheck,
  FaMapMarkerAlt,
  FaPhone,
  FaSearch,
  FaStar,
  FaTools,
} from 'react-icons/fa';

type VisitType = 'in-shop' | 'road-call';

interface Shop {
  id: string;
  name: string;
  address: string;
  zipCode: string;
  phone: string;
  rating: number;
  completedJobs: number;
}

interface ShopService {
  id: string;
  serviceName: string;
  category: string;
  price: number | null;
  duration: number | null;
  description: string | null;
}

interface Vehicle {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
}

export default function NewAppointmentClient() {
  useRequireAuth(['customer']);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedShopId = searchParams?.get('shopId') || null;

  const [step, setStep] = useState(preselectedShopId ? 2 : 1);
  const [shops, setShops] = useState<Shop[]>([]);
  const [services, setServices] = useState<ShopService[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [loadingShops, setLoadingShops] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [bookingMsg, setBookingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [visitType, setVisitType] = useState<VisitType | null>(null);
  const [selectedService, setSelectedService] = useState<ShopService | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('09:00');
  const [details, setDetails] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (!preselectedShopId) return;
    fetchShopById(preselectedShopId);
  }, [preselectedShopId]);

  const groupedServices = useMemo(() => {
    return services.reduce((acc, service) => {
      const category = service.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {} as Record<string, ShopService[]>);
  }, [services]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const fetchShopById = async (shopId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/shops/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const shop = data.shop;
      if (!shop) return;

      const normalized: Shop = {
        id: shop.id,
        name: shop.shopName || shop.name || 'Shop',
        address: shop.address || '',
        zipCode: shop.zipCode || '',
        phone: shop.phone || '',
        rating: Number(shop.averageRating || 0),
        completedJobs: Number(shop.completedJobs || 0),
      };

      setSelectedShop(normalized);
      setStep(2);
      setServices(shop.services || []);
    } catch (error) {
      console.error('Error fetching preselected shop:', error);
    }
  };

  const fetchShops = async (search: string) => {
    try {
      setLoadingShops(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(`/api/customers/shops?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const normalized = (data.shops || []).map((s: any) => ({
        id: s.id,
        name: s.name || s.shopName || 'Shop',
        address: s.address || '',
        zipCode: s.zipCode || '',
        phone: s.phone || '',
        rating: Number(s.rating || s.averageRating || 0),
        completedJobs: Number(s.completedJobs || 0),
      }));
      setShops(normalized);
      setHasSearched(true);
    } catch (error) {
      console.error('Error fetching shops:', error);
    } finally {
      setLoadingShops(false);
    }
  };

  const fetchShopServices = async (shopId: string) => {
    try {
      setLoadingServices(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/shops/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      setServices(data.shop?.services || []);
    } catch (error) {
      console.error('Error fetching shop services:', error);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers/vehicles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.vehicles || data || [];
      setVehicles(list);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const handleSearch = () => {
    const term = searchTerm.trim();
    if (!term) return;
    fetchShops(term);
  };

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
    setVisitType(null);
    setSelectedService(null);
    setServices([]);
    fetchShopServices(shop.id);
    setStep(2);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'fixtray';
      const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'fixtray_uploads';

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', preset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.secure_url) {
            setMediaUrls((prev) => [...prev, data.secure_url]);
          }
        }
      }
    } catch (error) {
      console.error('Media upload failed:', error);
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  };

  const submitAppointment = async () => {
    if (!selectedShop || !visitType || !selectedService) {
      setBookingMsg({ type: 'error', text: 'Please complete all required steps first.' });
      return;
    }

    if (visitType === 'in-shop' && (!appointmentDate || !appointmentTime)) {
      setBookingMsg({ type: 'error', text: 'Please choose appointment date and time for in-shop service.' });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const scheduledDate = visitType === 'in-shop'
        ? new Date(`${appointmentDate}T${appointmentTime}`).toISOString()
        : new Date().toISOString();

      const payload = {
        shopId: selectedShop.id,
        serviceType: selectedService.serviceName,
        scheduledDate,
        appointmentType: visitType,
        vehicleId: selectedVehicleId || undefined,
        vehicleInfo: {
          make: vehicleMake || undefined,
          model: vehicleModel || undefined,
          year: vehicleYear || undefined,
          licensePlate: vehiclePlate || undefined,
        },
        notes: details || undefined,
        mediaUrls,
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setBookingMsg({ type: 'error', text: error.error || 'Failed to create appointment.' });
        return;
      }

      router.push('/customer/appointments?success=true' as Route);
    } catch (error) {
      console.error('Error creating appointment:', error);
      setBookingMsg({ type: 'error', text: 'Failed to create appointment.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(229,51,42,0.3)', padding: '20px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/customer/appointments" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'inline-block' }}>
            <FaArrowLeft style={{ marginRight: 4 }} /> Back to Appointments
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
            <FaCalendarAlt style={{ marginRight: 4 }} /> Book New Appointment
          </h1>
          <p style={{ fontSize: 14, color: '#9aa3b2' }}>Choose shop, visit type, services, and details.</p>
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[
            { num: 1, label: 'Select Shop' },
            { num: 2, label: 'Visit Type' },
            { num: 3, label: 'Choose Service' },
            { num: 4, label: 'Date & Details' },
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: step >= s.num ? '#e5332a' : 'rgba(255,255,255,0.1)',
                    color: step >= s.num ? 'white' : '#9aa3b2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {step > s.num ? <FaCheck /> : s.num}
                </div>
                <span style={{ color: step >= s.num ? '#e5e7eb' : '#6b7280', fontSize: 13, fontWeight: 600 }}>{s.label}</span>
              </div>
              {i < 3 && <div style={{ width: 40, height: 2, background: step > s.num ? '#e5332a' : 'rgba(255,255,255,0.1)' }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Select a Shop</h2>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 12, maxWidth: 620 }}>
                <input
                  type="text"
                  placeholder="Enter zip code or shop name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#e5e7eb',
                    fontSize: 16,
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={!searchTerm.trim() || loadingShops}
                  style={{
                    padding: '14px 28px',
                    background: searchTerm.trim() ? '#e5332a' : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: searchTerm.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loadingShops ? '...' : <><FaSearch style={{ marginRight: 4 }} /> Search</>}
                </button>
              </div>
            </div>

            {!hasSearched ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9aa3b2' }}>
                Enter a zip code or shop name to find available shops.
              </div>
            ) : shops.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9aa3b2' }}>No shops found.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {shops.map((shop) => (
                  <div
                    key={shop.id}
                    onClick={() => handleShopSelect(shop)}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      padding: 20,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb' }}>{shop.name}</h3>
                      {shop.rating > 0 && (
                        <span style={{ padding: '4px 8px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          <FaStar style={{ marginRight: 4 }} /> {shop.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#9aa3b2' }}><FaMapMarkerAlt style={{ marginRight: 4 }} /> {shop.address}</div>
                    <div style={{ fontSize: 13, color: '#9aa3b2', marginTop: 6 }}><FaPhone style={{ marginRight: 4 }} /> {shop.phone}</div>
                    <div style={{ fontSize: 12, color: '#22c55e', marginTop: 8 }}>{shop.completedJobs} completed jobs</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedShop && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Choose Visit Type</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <button
                onClick={() => {
                  setVisitType('in-shop');
                  setStep(3);
                }}
                style={{
                  textAlign: 'left',
                  padding: 20,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(34,197,94,0.35)',
                  borderRadius: 12,
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>In Shop</div>
                <div style={{ color: '#9aa3b2', fontSize: 13 }}>Bring your vehicle to the shop and choose a date/time.</div>
              </button>

              <button
                onClick={() => {
                  setVisitType('road-call');
                  setStep(3);
                }}
                style={{
                  textAlign: 'left',
                  padding: 20,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(59,130,246,0.35)',
                  borderRadius: 12,
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Road Call</div>
                <div style={{ color: '#9aa3b2', fontSize: 13 }}>Request mobile service. We will create a road-call work order with this shop.</div>
              </button>
            </div>

            <div style={{ marginTop: 18 }}>
              <button onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#9aa3b2', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
                <FaArrowLeft style={{ marginRight: 4 }} /> Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && selectedShop && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e5e7eb', marginBottom: 20 }}>Choose a Service</h2>
            {loadingServices ? (
              <div style={{ color: '#9aa3b2' }}>Loading services...</div>
            ) : services.length === 0 ? (
              <div style={{ color: '#9aa3b2' }}>This shop has no services configured yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {Object.entries(groupedServices).map(([category, categoryServices]) => (
                  <div key={category} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 14, color: '#9aa3b2', marginBottom: 10 }}>{category}</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {categoryServices.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => {
                            setSelectedService(service);
                            setStep(4);
                          }}
                          style={{
                            textAlign: 'left',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            padding: 12,
                            color: '#e5e7eb',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 700 }}><FaTools style={{ marginRight: 4 }} /> {service.serviceName}</div>
                          {service.description && <div style={{ fontSize: 12, color: '#9aa3b2', marginTop: 4 }}>{service.description}</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <button onClick={() => setStep(2)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#9aa3b2', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
                <FaArrowLeft style={{ marginRight: 4 }} /> Back
              </button>
            </div>
          </div>
        )}

        {step === 4 && selectedShop && selectedService && visitType && (
          <div style={{ display: 'grid', gap: 18 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e5e7eb', marginBottom: 0 }}>Date & Details</h2>

            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 8 }}>Selected shop</div>
              <div style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 700 }}>{selectedShop.name}</div>
              <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 6 }}>{selectedService.serviceName} • {visitType === 'in-shop' ? 'In Shop' : 'Road Call'}</div>
            </div>

            {visitType === 'in-shop' && (
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 10 }}>Choose Date & Time</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 480 }}>
                  <input
                    type="date"
                    min={today}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }}
                  />
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }}
                  />
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 10 }}><FaCar style={{ marginRight: 4 }} /> Vehicle Information</div>

              {vehicles.length > 0 && (
                <select
                  value={selectedVehicleId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedVehicleId(id);
                    const v = vehicles.find((x) => x.id === id);
                    if (v) {
                      setVehicleMake(v.make || '');
                      setVehicleModel(v.model || '');
                      setVehicleYear(v.year ? String(v.year) : '');
                      setVehiclePlate(v.licensePlate || '');
                    }
                  }}
                  style={{ width: '100%', maxWidth: 520, marginBottom: 10, padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }}
                >
                  <option value="">Select saved vehicle (optional)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.year, v.make, v.model].filter(Boolean).join(' ')} {v.licensePlate ? `• ${v.licensePlate}` : ''}
                    </option>
                  ))}
                </select>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, maxWidth: 740 }}>
                <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="Make" style={{ padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }} />
                <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Model" style={{ padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }} />
                <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} placeholder="Year" style={{ padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }} />
                <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="License plate" style={{ padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }} />
              </div>

              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the issue or any additional details..."
                rows={5}
                style={{ width: '100%', maxWidth: 740, marginTop: 10, padding: '10px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb', resize: 'vertical' }}
              />
            </div>

            {visitType === 'in-shop' && (
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 10 }}><FaCamera style={{ marginRight: 4 }} /> Photos / Videos (Optional)</div>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 8,
                    background: '#e5332a',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 700,
                    opacity: uploadingMedia ? 0.7 : 1,
                  }}
                >
                  {uploadingMedia ? 'Uploading...' : 'Add photos/videos'}
                  <input type="file" accept="image/*,video/*" multiple onChange={handleMediaUpload} style={{ display: 'none' }} />
                </label>

                {mediaUrls.length > 0 && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    {mediaUrls.map((url, index) => (
                      <div key={url + index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px' }}>
                        <a href={url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                          Media {index + 1}
                        </a>
                        <button
                          onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== index))}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(3)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#9aa3b2', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
                <FaArrowLeft style={{ marginRight: 4 }} /> Back
              </button>
              <button
                onClick={submitAppointment}
                disabled={submitting}
                style={{
                  background: '#e5332a',
                  border: 'none',
                  color: 'white',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Creating...' : 'Create Appointment'}
              </button>
            </div>
          </div>
        )}
      </div>

      {bookingMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: bookingMsg.type === 'success' ? '#dcfce7' : '#fde8e8', color: bookingMsg.type === 'success' ? '#166534' : '#991b1b', borderRadius: 10, padding: '12px 20px', zIndex: 9999, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {bookingMsg.text}
          <button aria-label="Dismiss" onClick={() => setBookingMsg(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit' }}>
            x
          </button>
        </div>
      )}
    </div>
  );
}
