'use client';

import { useEffect, useState, Suspense } from 'react';
import { FaArrowLeft, FaArrowRight, FaBell, FaBox, FaBuilding, FaCalendarAlt, FaCar, FaCheck, FaClipboardList, FaClock, FaCog, FaComments, FaCreditCard, FaExclamationCircle, FaSignOutAlt, FaStar, FaTimes, FaTrash, FaTruck, FaWrench } from 'react-icons/fa';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FIXTRAY_SHOP_PARTICIPATION_AGREEMENT } from '@/lib/fixtrayShopParticipationAgreement';

type CategoryId = 'diesel' | 'gas' | 'small-engine' | 'heavy-equipment' | 'resurfacing' | 'welding' | 'tire';

// Service type options
const DIESEL_SERVICES = [
  'Engine Diagnostics',
  'Engine Repair',
  'Engine Rebuild',
  'Transmission Repair',
  'Brake System',
  'Air Brake Service',
  'Electrical Diagnostics',
  'Electrical Repair',
  'Tire Service',
  'Tire Replacement',
  'Wheel Alignment',
  'Suspension Repair',
  'Hydraulic Systems',
  'Air Conditioning',
  'Exhaust Repair',
  'DEF System',
  'DPF Cleaning',
  'Oil Change',
  'Preventive Maintenance',
  'DOT Inspections',
  'Trailer Repair',
  'Reefer Repair',
  'Welding',
  'Roadside Assistance'
];

const GAS_SERVICES = [
  'Engine Diagnostics',
  'Engine Repair',
  'Transmission Service',
  'Transmission Repair',
  'Brake Service',
  'Brake Replacement',
  'Oil Change',
  'Tune-up',
  'Electrical Diagnostics',
  'Electrical Repair',
  'Battery Service',
  'Tire Rotation',
  'Tire Replacement',
  'Wheel Alignment',
  'Suspension Repair',
  'Air Conditioning',
  'Heating Repair',
  'Exhaust Repair',
  'Catalytic Converter',
  'Emissions Testing',
  'State Inspection',
  'Windshield Replacement',
  'Fluid Service',
  'Coolant Flush',
  'Fuel System Cleaning',
  'Timing Belt',
  'Roadside Assistance'
];

const SMALL_ENGINE_SERVICES = [
  'Engine Diagnostics',
  'Carburetor Cleaning & Rebuild',
  'Fuel System Repair',
  'Ignition System Repair',
  'Spark Plug Replacement',
  'Oil Change & Filter Service',
  'Air Filter Cleaning/Replacement',
  'Tune-Up',
  'Blade Sharpening',
  'Belt Replacement',
  'Starter Repair',
  'Recoil Starter Repair',
  'Compression Testing',
  'Two-Stroke / Four-Stroke Service',
  'Chain Sharpening (Chainsaws)',
  'String Trimmer Repair',
  'Blower Repair',
  'Generator Service',
  'Pressure Washer Repair',
  'Preventive Maintenance',
  'Parts Replacement',
  'Winterization / Storage Prep'
];

const HEAVY_EQUIPMENT_SERVICES = [
  'Hydraulic System Diagnostics & Repair',
  'Hydraulic Cylinder Rebuild',
  'Undercarriage Inspection & Repair',
  'Track / Chain Replacement',
  'Sprocket & Roller Replacement',
  'Final Drive Repair',
  'Engine Diagnostics & Repair',
  'Transmission Service & Repair',
  'Boom & Arm Repair',
  'Bucket / Blade Repair',
  'Pin & Bushing Replacement',
  'Electrical System Repair',
  'Brake System Service',
  'Cooling System Flush & Repair',
  'Preventive Maintenance',
  'Field Service / On-Site Repair',
  'Welding & Fabrication Repair',
  'Pump Repair',
  'Valve Adjustment',
  'Heavy Equipment Inspections'
];

const RESURFACING_SERVICES = [
  'Cylinder Head Resurfacing',
  'Engine Block Resurfacing',
  'Flywheel Resurfacing',
  'Brake Rotor Resurfacing',
  'Surface Grinding',
  'Milling & Machining',
  'Line Boring',
  'Valve Seat Cutting',
  'Crankshaft Grinding',
  'Align Boring',
  'Sleeving / Boring Engine Cylinders',
  'Precision Measurement & Inspection',
  'Custom Machining',
  'Head Gasket Surface Prep',
  'Deck Surfacing'
];

const WELDING_SERVICES = [
  'MIG Welding',
  'TIG Welding',
  'Stick Welding',
  'Aluminum Welding',
  'Stainless Steel Welding',
  'Cast Iron Repair Welding',
  'Structural Welding',
  'Custom Fabrication',
  'Weld Repairs',
  'Hardfacing / Wear Resistant Overlay',
  'Mobile / On-Site Welding',
  'Pipe Welding',
  'Trailer & Frame Repair',
  'Heavy Equipment Weld Repair',
  'Metal Cutting & Preparation',
  'Weld Inspection & Testing'
];

const TIRE_SHOP_SERVICES = [
  'Tire Replacement',
  'Tire Installation',
  'Flat Tire Repair',
  'Tire Patching',
  'Tire Rotation',
  'Wheel Balancing',
  'Wheel Alignment',
  'Tire Pressure Monitoring System (TPMS) Service',
  'TPMS Sensor Replacement',
  'Tire Inspection',
  'Tread Depth Check',
  'Tire Mounting',
  'Tire Demounting',
  'Valve Stem Replacement',
  'Tire Plug Repair',
  'Run-Flat Tire Service',
  'Seasonal Tire Changeover (Winter/Summer)',
  'Tire Storage',
  'Used Tire Sales',
  'Tire Disposal / Recycling',
  'Road Hazard Warranty',
  'Tire Roadside Assistance',
  'Custom Wheel Installation',
  'Rim Repair',
  'Preventive Tire Maintenance'
];

const SERVICE_OPTIONS: Record<CategoryId, string[]> = {
  diesel: DIESEL_SERVICES,
  gas: GAS_SERVICES,
  'small-engine': SMALL_ENGINE_SERVICES,
  'heavy-equipment': HEAVY_EQUIPMENT_SERVICES,
  resurfacing: RESURFACING_SERVICES,
  welding: WELDING_SERVICES,
  tire: TIRE_SHOP_SERVICES,
};

const CATEGORY_CONFIG: Array<{ id: CategoryId; label: string; color: string; bg: string; hoverBg: string; border: string; badge?: string }> = [
  { id: 'diesel', label: 'Diesel / Heavy-Duty', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', hoverBg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.3)' },
  { id: 'gas', label: 'Gas / Automotive', color: '#e5332a', bg: 'rgba(229,51,42,0.1)', hoverBg: 'rgba(229,51,42,0.2)', border: 'rgba(229,51,42,0.3)' },
  { id: 'small-engine', label: 'Small Engine', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', hoverBg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.3)' },
  { id: 'heavy-equipment', label: 'Heavy Equipment', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', hoverBg: 'rgba(139,92,246,0.2)', border: 'rgba(139,92,246,0.3)' },
  { id: 'resurfacing', label: 'Resurfacing / Machining', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', hoverBg: 'rgba(6,182,212,0.2)', border: 'rgba(6,182,212,0.3)' },
  { id: 'welding', label: 'Welding & Fabrication', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', hoverBg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.3)' },
  { id: 'tire', label: 'Tire Shop', color: '#f97316', bg: 'rgba(249,115,22,0.1)', hoverBg: 'rgba(249,115,22,0.2)', border: 'rgba(249,115,22,0.3)' },
];

const FIXTRAY_AGREEMENT_VERSION = '2026-06-01';

interface Service {
  id: string;
  serviceName: string;
  category: string;
  price: number | null;
  duration?: number | null;
  description?: string | null;
}

function ShopSettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useRequireAuth(['shop']);

  const [_userName] = useState('');
  const [shopId, setShopId] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [_settingsLoaded, setSettingsLoaded] = useState(false);
  const [newService, setNewService] = useState({
    serviceName: '',
    customName: '',
    category: 'diesel' as CategoryId,
    price: ''
  });
  const [newServiceMode, setNewServiceMode] = useState<'catalog' | 'custom'>('catalog');
  const [editService, setEditService] = useState({
    price: '',
    duration: '',
    description: ''
  });
  const [settings, setSettings] = useState({
    shopName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    businessLicense: '',
    insurancePolicy: '',
    shopType: 'diesel',
    operatingHours: {
      monday: { open: '08:00', close: '18:00', closed: false },
      tuesday: { open: '08:00', close: '18:00', closed: false },
      wednesday: { open: '08:00', close: '18:00', closed: false },
      thursday: { open: '08:00', close: '18:00', closed: false },
      friday: { open: '08:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '14:00', closed: false },
      sunday: { open: '09:00', close: '14:00', closed: true },
    }
  });
  const defaultNotificationPreferences = {
    // Parts notifications
    lowInventory: true,
    partsDelivered: true,
    partsOrdered: true,
    // Customer work order notifications
    newRoadCallOrder: true,
    // Payment notifications
    paymentReceived: true,
    // Message notifications
    messages: true,
    // Work order status notifications
    workOrderCreated: true,
    workOrderStarted: true,
    workOrderCompleted: true,
    techArrived: true,
    techLeaving: true,
    estimateApproved: true,
    estimateRejected: true,
  };
  const [notifications, setNotifications] = useState(defaultNotificationPreferences);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [notificationSaveMessage, setNotificationSaveMessage] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementSignature, setAgreementSignature] = useState('');
  const [agreementSignedAt, setAgreementSignedAt] = useState<string | null>(null);
  const [agreementError, setAgreementError] = useState('');
  const [showAgreementModal, setShowAgreementModal] = useState(false);

  // Stripe Connect payout account state
  const [_stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [_stripeConnectMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Billing tab removed.
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [serviceMsg, setServiceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [removeServiceConfirmId, setRemoveServiceConfirmId] = useState<string | null>(null);

  const isCustomService = (service: Service) => {
    const options = SERVICE_OPTIONS[service.category as CategoryId] || [];
    return !options.includes(service.serviceName);
  };

  const loadSettings = async (resolvedShopId?: string) => {
    try {
      setLoading(true);
      const localShopId = resolvedShopId || localStorage.getItem('shopId') || user?.id || '';
      if (!localShopId) {
        setLoading(false);
        return;
      }

      setShopId(localShopId);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shops/settings?shopId=${localShopId}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        setSettingsMsg({ type: 'error', text: 'Failed to load shop settings' });
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data?.shop) {
        setSettings((prev) => ({
          ...prev,
          shopName: data.shop.shopName || '',
          email: data.shop.email || '',
          phone: data.shop.phone || '',
          address: data.shop.address || '',
          city: data.shop.city || '',
          state: data.shop.state || '',
          zipCode: data.shop.zipCode || '',
          businessLicense: data.shop.businessLicense || '',
          insurancePolicy: data.shop.insurancePolicy || '',
          shopType: data.shop.shopType || 'diesel',
        }));
        setServices(Array.isArray(data.shop.services) ? data.shop.services : []);
        setStripeConnected(!!data.shop.stripeConnected);
      }

      if (data?.settings) {
        setNotificationsEnabled(data.settings.notificationsEnabled ?? true);
        setNotificationSoundEnabled(data.settings.notificationSoundEnabled ?? true);
        setNotifications((prev) => ({ ...prev, ...(data.settings.notificationPreferences || {}) }));
        const agreement = data.settings.fixtrayAgreement as
          | { accepted?: boolean; signedBy?: string; signedAt?: string }
          | null;
        if (agreement?.accepted) {
          setAgreementAccepted(true);
          setAgreementSignature(String(agreement.signedBy || ''));
          setAgreementSignedAt(String(agreement.signedAt || ''));
          if (typeof window !== 'undefined') localStorage.setItem('fixtrayAgreementAccepted', 'true');
        } else {
          setAgreementAccepted(false);
          setAgreementSignature('');
          setAgreementSignedAt(null);
          if (typeof window !== 'undefined') localStorage.removeItem('fixtrayAgreementAccepted');
        }
      }
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettingsMsg({ type: 'error', text: 'Error loading shop settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/auth/login' as Route);
      return;
    }

    const payment = searchParams?.get('payment');
    if (payment === 'success' || payment === 'canceled') {
      setSettingsMsg({
        type: payment === 'success' ? 'success' : 'error',
        text: payment === 'success' ? 'Payment processed successfully.' : 'Payment flow was canceled.',
      });
      router.replace('/shop/settings' as Route, { scroll: false });
    }

    const requestedTab = searchParams?.get('tab');
    if (requestedTab && ['general', 'hours', 'notifications'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }

    loadSettings();
  }, [isLoading, user, router, searchParams]);

  const saveNotificationSettings = async (
    nextPrefs: typeof defaultNotificationPreferences = notifications,
    nextEnabled: boolean = notificationsEnabled,
    nextSound: boolean = notificationSoundEnabled,
  ) => {
    if (!shopId) return;
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/shops/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          shopId,
          notificationSettings: {
            notificationsEnabled: nextEnabled,
            notificationSoundEnabled: nextSound,
            notificationPreferences: nextPrefs,
          },
        }),
      });
      setNotificationSaveMessage('Saved');
      setTimeout(() => setNotificationSaveMessage(''), 2000);
    } catch {
      setNotificationSaveMessage('Failed to save');
      setTimeout(() => setNotificationSaveMessage(''), 2000);
    }
  };

  const handleNotificationToggle = (key: keyof typeof defaultNotificationPreferences) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    saveNotificationSettings(next);
  };

  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushStatus('Push notifications are not supported in this browser.');
      return;
    }

    const permission = await Notification.requestPermission();
    setPushStatus(permission === 'granted' ? 'Push notifications enabled.' : 'Push notifications not enabled.');
  };

  const handleSave = async () => {
    if (!shopId) {
      setSettingsMsg({ type: 'error', text: 'Shop ID not found' });
      return;
    }

    if (!agreementAccepted || !agreementSignature.trim()) {
      setAgreementError('You must accept and sign the FixTray agreement before using the platform.');
      setActiveTab('general');
      return;
    }

    setAgreementError('');
    const signedAt = agreementSignedAt || new Date().toISOString();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/shops/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          shopId,
          shopName: settings.shopName,
          email: settings.email,
          phone: settings.phone,
          address: settings.address,
          city: settings.city,
          state: settings.state,
          zipCode: settings.zipCode,
          notificationSettings: {
            notificationsEnabled,
            notificationSoundEnabled,
            notificationPreferences: notifications,
          },
          fixtrayAgreement: {
            accepted: true,
            signedBy: agreementSignature.trim(),
            signedAt,
            version: FIXTRAY_AGREEMENT_VERSION,
          },
        }),
      });

      if (response.ok) {
        setAgreementSignedAt(signedAt);
        localStorage.setItem('fixtrayAgreementAccepted', 'true');
        setSettingsMsg({ type: 'success', text: 'Settings saved successfully' });
        setTimeout(() => setSettingsMsg(null), 3000);
      } else {
        setSettingsMsg({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettingsMsg({ type: 'error', text: 'Error saving settings' });
    }
  };

  const handleSignAgreement = () => {
    if (!agreementAccepted || !agreementSignature.trim()) {
      setAgreementError('You must check acceptance and provide your full legal signature.');
      return;
    }

    setAgreementSignedAt(new Date().toISOString());
    setAgreementError('');
    setShowAgreementModal(false);
  };

  const agreementDisplayText = FIXTRAY_SHOP_PARTICIPATION_AGREEMENT
    .replace(/\[DATE\]/g, new Date().toLocaleDateString())
    .replace(/\[LEGAL SHOP NAME\]/g, settings.shopName || '[LEGAL SHOP NAME]')
    .replace(/\[SHOP_LEGAL_NAME\]/g, settings.shopName || '[SHOP_LEGAL_NAME]')
    .replace(/\[SHOP_ADMIN_FULL_NAME\]/g, agreementSignature || '[SHOP_ADMIN_FULL_NAME]')
    .replace(/\[SHOP_ADMIN_EMAIL\]/g, settings.email || '[SHOP_ADMIN_EMAIL]')
    .replace(/\[SHOP_ADMIN_ESIGN_UTC\]/g, agreementSignedAt || '[SHOP_ADMIN_ESIGN_UTC]');

  const handleAddService = async () => {
    if (!shopId) {
      setServiceMsg({ type: 'error', text: 'Shop ID not found' });
      return;
    }

    const serviceName = newServiceMode === 'catalog' ? newService.serviceName : newService.customName.trim();
    if (!serviceName) {
      setServiceMsg({ type: 'error', text: 'Please select or enter a service name' });
      return;
    }

    try {
      const csrf = typeof document !== 'undefined'
        ? document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith('csrf_token='))?.split('=')[1]
        : null;

      const response = await fetch('/api/shops/services', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf || '',
        },
        body: JSON.stringify({
          shopId,
          serviceName,
          category: newService.category,
          price: newService.price ? parseFloat(newService.price) : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setServices((prev) => [...prev, data.service]);
        setShowAddServiceModal(false);
        setNewService({ serviceName: '', customName: '', category: 'diesel', price: '' });
        setNewServiceMode('catalog');
        setServiceMsg({ type: 'success', text: 'Service added successfully!' });
        setTimeout(() => setServiceMsg(null), 3000);
      } else {
        const payload = await response.json().catch(() => ({}));
        setServiceMsg({ type: 'error', text: payload.error || 'Failed to add service' });
      }
    } catch (error) {
      console.error('Error adding service:', error);
      setServiceMsg({ type: 'error', text: 'Error adding service' });
    }
  };

  const handlePopulateDefaults = async () => {
    if (!shopId) { setSettingsMsg({ type: 'error', text: 'Shop ID not found' }); return; }
    const toCreate = CATEGORY_CONFIG.flatMap((cat) =>
      (SERVICE_OPTIONS[cat.id] || []).map((s) => ({ serviceName: s, category: cat.id }))
    );

    let created = 0;
    for (const item of toCreate) {
      try {
        const csrf = typeof document !== 'undefined' ? document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1] : null;
        const res = await fetch('/api/shops/services', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf || '' },
          body: JSON.stringify({ shopId, serviceName: item.serviceName, category: item.category }),
        });
        if (res.ok) created += 1;
      } catch {
        // ignore individual errors
      }
    }
    setSettingsMsg({ type: 'success', text: `Imported ${created} default services` });
    setTimeout(() => setSettingsMsg(null), 4000);
    // reload services
    await loadSettings(shopId);
  };

  const handleRemoveService = async (serviceId: string) => {
    try {
      const csrf = typeof document !== 'undefined' ? document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1] : null;
      const response = await fetch(`/api/shops/services?serviceId=${serviceId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'x-csrf-token': csrf || '' },
      });

      if (response.ok) {
        setServices(services.filter(s => s.id !== serviceId));
        setServiceMsg({ type: 'success', text: 'Service removed successfully!' });
        setTimeout(() => setServiceMsg(null), 3000);
      } else {
        setServiceMsg({ type: 'error', text: 'Failed to remove service' });
      }
    } catch (error) {
      console.error('Error removing service:', error);
      setServiceMsg({ type: 'error', text: 'Error removing service' });
    } finally {
      setRemoveServiceConfirmId(null);
    }
  };

  const handleOpenEditService = (service: Service) => {
    setSelectedService(service);
    setEditService({
      price: service.price?.toString() || '',
      duration: service.duration ? (service.duration / 60).toString() : '', // Convert minutes to hours for display
      description: service.description || ''
    });
    setShowEditServiceModal(true);
  };

  const handleUpdateService = async () => {
    if (!selectedService) return;

    try {
      const csrf = typeof document !== 'undefined' ? document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1] : null;
      const response = await fetch('/api/shops/services', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf || '' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          price: editService.price ? parseFloat(editService.price) : null,
          duration: editService.duration ? Math.round(parseFloat(editService.duration) * 60) : null, // Convert hours to minutes
          description: editService.description || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setServices(services.map(s => s.id === selectedService.id ? data.service : s));
        setShowEditServiceModal(false);
        setSelectedService(null);
        setServiceMsg({ type: 'success', text: 'Service updated successfully!' });
        setTimeout(() => setServiceMsg(null), 3000);
      } else {
        setServiceMsg({ type: 'error', text: 'Failed to update service' });
      }
    } catch (error) {
      console.error('Error updating service:', error);
      setServiceMsg({ type: 'error', text: 'Error updating service' });
    }
  };

  const tabs = [
    { id: 'general', icon: <FaBuilding />, name: 'General Info' },
    { id: 'hours', icon: <FaClock />, name: 'Operating Hours' },
    { id: 'notifications', icon: <FaBell />, name: 'Notifications' },
  ];

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1200, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <Link href="/shop/admin#overview" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:8, display:'inline-block'}}>
              <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
            </Link>
            <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:4, display:'flex', alignItems:'center', gap:12}}>
              <FaCog style={{fontSize:28, color:'#e5e7eb'}} /> Shop Settings
            </h1>
            <p style={{fontSize:14, color:'#9aa3b2'}}>Manage your shop information and preferences</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('userRole');
              localStorage.removeItem('userName');
              localStorage.removeItem('shopId');
              localStorage.removeItem('userId');
              router.push('/auth/login' as Route);
            }}
            style={{
              padding:'10px 20px',
              background:'#dc2626',
              color:'white',
              border:'none',
              borderRadius:8,
              fontSize:14,
              fontWeight:600,
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              gap:8
            }}
          >
            <FaSignOutAlt style={{marginRight:8}} /> Sign Out
          </button>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        <div style={{display:'grid', gridTemplateColumns:'250px 1fr', gap:24}}>
          {/* Sidebar */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:16, height:'fit-content'}}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width:'100%',
                  padding:'12px 16px',
                  marginBottom:8,
                  background: activeTab === tab.id ? 'rgba(229,51,42,0.2)' : 'transparent',
                  color: activeTab === tab.id ? '#e5332a' : '#9aa3b2',
                  border: activeTab === tab.id ? '1px solid rgba(229,51,42,0.3)' : '1px solid transparent',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer',
                  textAlign:'left',
                  display:'flex',
                  alignItems:'center',
                  gap:12
                }}
              >
                <span>{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32}}>
            {activeTab === 'general' && (
              <div>
                <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:24}}>General Information</h2>
                
                <div style={{display:'grid', gap:20}}>
                  <div>
                    <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Shop Name</label>
                    <input type="text" value={settings.shopName} onChange={(e) => setSettings({...settings, shopName: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                    <div>
                      <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Email</label>
                      <input type="email" value={settings.email} onChange={(e) => setSettings({...settings, email: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                    </div>
                    <div>
                      <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Phone</label>
                      <input type="tel" value={settings.phone} onChange={(e) => setSettings({...settings, phone: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                    </div>
                  </div>

                  <div>
                    <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Address</label>
                    <input type="text" value={settings.address} onChange={(e) => setSettings({...settings, address: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:16}}>
                    <div>
                      <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>City</label>
                      <input type="text" value={settings.city} onChange={(e) => setSettings({...settings, city: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                    </div>
                    <div>
                      <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>State</label>
                      <input type="text" value={settings.state} onChange={(e) => setSettings({...settings, state: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                    </div>
                    <div>
                      <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>ZIP Code</label>
                      <input type="text" value={settings.zipCode} onChange={(e) => setSettings({...settings, zipCode: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                    </div>
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                    <div>
                      <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Business License</label>
                      <input type="text" value={settings.businessLicense} onChange={(e) => setSettings({...settings, businessLicense: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                    </div>
                    <div>
                      <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Insurance Policy</label>
                      <input type="text" value={settings.insurancePolicy} onChange={(e) => setSettings({...settings, insurancePolicy: e.target.value})} style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} />
                    </div>
                  </div>

                  <div style={{ marginTop: 8, padding: 16, borderRadius: 10, background: 'rgba(229,51,42,0.10)', border: '1px solid rgba(229,51,42,0.35)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb' }}>FixTray Shop Participation Agreement</div>
                        <div style={{ fontSize: 12, color: '#9aa3b2' }}>Agreement version: {FIXTRAY_AGREEMENT_VERSION}</div>
                      </div>
                      <button
                        onClick={() => setShowAgreementModal(true)}
                        style={{ padding: '10px 14px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.35)', color: '#e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {agreementSignedAt ? 'Review Agreement' : 'Read and Sign Agreement'}
                      </button>
                    </div>

                    {agreementSignedAt ? (
                      <div style={{ color: '#86efac', fontSize: 12 }}>
                        Signed by {agreementSignature || 'Shop Admin'} on {new Date(agreementSignedAt).toLocaleString()}
                      </div>
                    ) : (
                      <div style={{ color: '#fde68a', fontSize: 12 }}>
                        Signature required before saving settings and continuing platform access.
                      </div>
                    )}

                    {agreementError ? <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 8 }}>{agreementError}</div> : null}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'hours' && (
              <div>
                <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Operating Hours</h2>
                
                {/* Schedule Settings Link */}
                <Link
                  href="/shop/settings/schedule"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 20, marginBottom: 24, background: 'linear-gradient(135deg, rgba(229,51,42,0.18) 0%, rgba(0,0,0,0.85) 100%)',
                    border: '1px solid rgba(229,51,42,0.30)', borderRadius: 12,
                    textDecoration: 'none', transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize: 16, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
                      <FaCalendarAlt /> Advanced Scheduling Settings
                    </div>
                    <div style={{ fontSize: 13, color: '#9aa3b2' }}>
                      Manage capacity, time slots, blocked dates & customer booking availability
                    </div>
                  </div>
                  <FaArrowRight style={{ fontSize: 24, color: '#e5332a' }} />
                </Link>
                
                <div style={{display:'grid', gap:16}}>
                  {Object.entries(settings.operatingHours).map(([day, hours]) => (
                    <div key={day} style={{display:'flex', alignItems:'center', gap:16, padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8}}>
                      <div style={{width:100, fontSize:14, fontWeight:600, color:'#e5e7eb', textTransform:'capitalize'}}>{day}</div>
                      <input
                        type="time"
                        value={hours.open}
                        disabled={hours.closed}
                        onChange={e => {
                          setSettings({
                            ...settings,
                            operatingHours: {
                              ...settings.operatingHours,
                              [day]: { ...hours, open: e.target.value }
                            }
                          });
                        }}
                        style={{padding:'8px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, color:'#e5e7eb', fontSize:13}}
                      />
                      <span style={{color:'#9aa3b2'}}>to</span>
                      <input
                        type="time"
                        value={hours.close}
                        disabled={hours.closed}
                        onChange={e => {
                          setSettings({
                            ...settings,
                            operatingHours: {
                              ...settings.operatingHours,
                              [day]: { ...hours, close: e.target.value }
                            }
                          });
                        }}
                        style={{padding:'8px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, color:'#e5e7eb', fontSize:13}}
                      />
                      <label style={{display:'flex', alignItems:'center', gap:8, marginLeft:'auto', color:'#9aa3b2', cursor:'pointer'}}>
                        <input
                          type="checkbox"
                          checked={hours.closed}
                          onChange={e => {
                            setSettings({
                              ...settings,
                              operatingHours: {
                                ...settings.operatingHours,
                                [day]: { ...hours, closed: e.target.checked }
                              }
                            });
                          }}
                          style={{width:18, height:18, cursor:'pointer'}}
                        />
                        Closed
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'services_removed' && (
              <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
                  <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Offered Services</h2>
                  <div style={{display:'flex', gap:12}}>
                    <button 
                      onClick={() => setShowAddServiceModal(true)}
                      style={{padding:'10px 20px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                    >
                      + Add Service
                    </button>
                    <button
                      onClick={handlePopulateDefaults}
                      style={{padding:'10px 20px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                      title="Import default services for all categories"
                    >
                      Import Default Services
                    </button>
                  </div>
                </div>
                
                {loading ? (
                  <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>Loading services...</div>
                ) : services.length === 0 ? (
                  <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
                    <div style={{fontSize:48, marginBottom:16}}><FaWrench style={{marginRight:4}} /></div>
                    <p style={{marginBottom:16}}>No services configured</p>
                    <button 
                      onClick={() => setShowAddServiceModal(true)}
                      style={{padding:'12px 24px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
                    >
                      + Add First Service
                    </button>
                  </div>
                ) : (
                  <div style={{display:'grid', gap:24}}>
                    {services.some((s) => isCustomService(s)) && (
                      <div>
                        <h3 style={{fontSize:16, fontWeight:700, color:'#f59e0b', marginBottom:12}}>Custom Services ({services.filter(isCustomService).length})</h3>
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:12}}>
                          {services.filter(isCustomService).map((service) => (
                            <div
                              key={service.id}
                              onClick={() => handleOpenEditService(service)}
                              style={{
                                padding:12,
                                background:'rgba(245,158,11,0.1)',
                                border:'1px solid rgba(245,158,11,0.3)',
                                borderRadius:8,
                                display:'flex',
                                justifyContent:'space-between',
                                alignItems:'center',
                                cursor:'pointer',
                                transition:'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(245,158,11,0.2)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(245,158,11,0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              <div style={{display:'flex', alignItems:'center', gap:8, flex:1}}>
                                <span style={{color:'#f59e0b', fontSize:16}}><FaStar style={{marginRight:4}} /></span>
                                <div>
                                  <div style={{color:'#e5e7eb', fontSize:14, fontWeight:600}}>{service.serviceName}</div>
                                  {(service.price || service.duration) && (
                                    <div style={{color:'#9aa3b2', fontSize:11, marginTop:2}}>
                                      {service.price && `$${service.price}`}
                                      {service.price && service.duration && ' - '}
                                      {service.duration && `${(service.duration / 60).toFixed(1)}h`}
                                    </div>
                                  )}
                                  <div style={{color:'#9aa3b2', fontSize:11, marginTop:4}}>Category: {service.category}</div>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRemoveServiceConfirmId(service.id);
                                }}
                                style={{background:'transparent', border:'none', color:'#e5332a', cursor:'pointer', fontSize:18, padding:4}}
                                title="Remove service"
                              >
                                
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {CATEGORY_CONFIG.map((cat) => {
                      const filtered = services.filter((s) => s.category === cat.id && !isCustomService(s));
                      return (
                        <div key={cat.id}>
                          <h3 style={{fontSize:16, fontWeight:600, color:cat.color, marginBottom:12}}>
                            {cat.label} ({filtered.length})
                          </h3>
                          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:12}}>
                            {filtered.map((service) => (
                              <div
                                key={service.id}
                                onClick={() => handleOpenEditService(service)}
                                style={{
                                  padding:12,
                                  background: cat.bg,
                                  border:`1px solid ${cat.border}`,
                                  borderRadius:8,
                                  display:'flex',
                                  justifyContent:'space-between',
                                  alignItems:'center',
                                  cursor:'pointer',
                                  transition:'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = cat.hoverBg;
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = cat.bg;
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <div style={{display:'flex', alignItems:'center', gap:8, flex:1}}>
                                  <span style={{color:cat.color, fontSize:16}}><FaCheck style={{marginRight:4}} /></span>
                                  <div>
                                    <div style={{color:'#e5e7eb', fontSize:14, fontWeight:600}}>{service.serviceName}</div>
                                    {(service.price || service.duration) && (
                                      <div style={{color:'#9aa3b2', fontSize:11, marginTop:2}}>
                                        {service.price && `$${service.price}`}
                                        {service.price && service.duration && ' - '}
                                        {service.duration && `${(service.duration / 60).toFixed(1)}h`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemoveServiceConfirmId(service.id);
                                  }}
                                  style={{background:'transparent', border:'none', color:'#e5332a', cursor:'pointer', fontSize:18, padding:4}}
                                  title="Remove service"
                                >
                                  
                                </button>
                              </div>
                            ))}
                            {filtered.length === 0 && (
                              <div style={{padding:16, border:`1px dashed ${cat.border}`, borderRadius:8, color:'#9aa3b2', fontSize:13}}>
                                No services added yet for {cat.label}.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:24}}>Notification Preferences</h2>
                <p style={{color:'#9aa3b2', marginBottom:32}}>Choose which notifications you want to receive</p>

                <div style={{marginBottom:24, padding:16, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
                    <div>
                      <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Enable notifications for all shop users</div>
                      <div style={{color:'#9aa3b2', fontSize:13}}>Applies to techs and managers (bell icon + in-app alerts).</div>
                    </div>
                    <button
                      onClick={() => {
                        const next = !notificationsEnabled;
                        setNotificationsEnabled(next);
                        saveNotificationSettings(undefined, next);
                      }}
                      style={{padding:'10px 16px', background:notificationsEnabled ? '#16a34a' : '#334155', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, fontWeight:600, cursor:'pointer'}}
                    >
                      {notificationsEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                <div style={{marginBottom:24, padding:16, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
                    <div>
                      <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Play audio chime</div>
                      <div style={{color:'#9aa3b2', fontSize:13}}>Plays a chime when new notifications arrive.</div>
                    </div>
                    <button
                      onClick={() => {
                        const next = !notificationSoundEnabled;
                        setNotificationSoundEnabled(next);
                        saveNotificationSettings(undefined, undefined, next);
                      }}
                      style={{padding:'10px 16px', background:notificationSoundEnabled ? '#16a34a' : '#334155', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, fontWeight:600, cursor:'pointer'}}
                    >
                      {notificationSoundEnabled ? 'Sound On' : 'Sound Off'}
                    </button>
                  </div>
                </div>

                <div style={{marginBottom:32, padding:16, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
                    <div>
                      <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Enable push notifications</div>
                      <div style={{color:'#9aa3b2', fontSize:13}}>Allow browser alerts for shop activity.</div>
                    </div>
                    <button onClick={handleEnablePush} style={{padding:'10px 16px', background:'#334155', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, fontWeight:600, cursor:'pointer'}}>
                      Enable
                    </button>
                  </div>
                  {pushStatus ? (
                    <div style={{marginTop:8, color:'#9aa3b2', fontSize:12}}>Status: {pushStatus}</div>
                  ) : null}
                  {notificationSaveMessage ? (
                    <div style={{marginTop:8, color:'#9aa3b2', fontSize:12}}>{notificationSaveMessage}</div>
                  ) : null}
                </div>

                {/* Parts Notifications */}
                <div style={{marginBottom:32}}>
                  <h3 style={{fontSize:16, fontWeight:600, color:'#f59e0b', marginBottom:16, display:'flex', alignItems:'center', gap:8}}>
                    <span><FaBox style={{marginRight:4}} /></span> Parts & Inventory
                  </h3>
                  <div style={{display:'grid', gap:12}}>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Low Inventory Alert</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Get notified when parts inventory is running low</div>
                      </div>
                      <input type="checkbox" checked={notifications.lowInventory} onChange={() => handleNotificationToggle('lowInventory')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Parts Delivered</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Get notified when ordered parts arrive</div>
                      </div>
                      <input type="checkbox" checked={notifications.partsDelivered} onChange={() => handleNotificationToggle('partsDelivered')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Parts Ordered</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Get notified when team members order parts</div>
                      </div>
                      <input type="checkbox" checked={notifications.partsOrdered} onChange={() => handleNotificationToggle('partsOrdered')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                  </div>
                </div>

                {/* Customer Work Orders */}
                <div style={{marginBottom:32}}>
                  <h3 style={{fontSize:16, fontWeight:600, color:'#e5332a', marginBottom:16, display:'flex', alignItems:'center', gap:8}}>
                    <span><FaExclamationCircle style={{marginRight:4}} /></span> Customer Work Orders
                  </h3>
                  <div style={{display:'grid', gap:12}}>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>New Road Call Order</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Get notified when customers create new roadside assistance requests</div>
                      </div>
                      <input type="checkbox" checked={notifications.newRoadCallOrder} onChange={() => handleNotificationToggle('newRoadCallOrder')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                  </div>
                </div>

                {/* Payment Notifications */}
                <div style={{marginBottom:32}}>
                  <h3 style={{fontSize:16, fontWeight:600, color:'#22c55e', marginBottom:16, display:'flex', alignItems:'center', gap:8}}>
                    <span><FaCreditCard style={{marginRight:4}} /></span> Payments
                  </h3>
                  <div style={{display:'grid', gap:12}}>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Payment Received</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Get notified when customers make payments</div>
                      </div>
                      <input type="checkbox" checked={notifications.paymentReceived} onChange={() => handleNotificationToggle('paymentReceived')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                  </div>
                </div>

                {/* Message Notifications */}
                <div style={{marginBottom:32}}>
                  <h3 style={{fontSize:16, fontWeight:600, color:'#ff6b64', marginBottom:16, display:'flex', alignItems:'center', gap:8}}>
                    <span><FaComments style={{marginRight:4}} /></span> Messages
                  </h3>
                  <div style={{display:'grid', gap:12}}>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>New Message Alerts</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Notify techs and managers when new messages arrive</div>
                      </div>
                      <input type="checkbox" checked={notifications.messages} onChange={() => handleNotificationToggle('messages')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                  </div>
                </div>

                {/* Work Order Status Updates */}
                <div style={{marginBottom:32}}>
                  <h3 style={{fontSize:16, fontWeight:600, color:'#e5332a', marginBottom:16, display:'flex', alignItems:'center', gap:8}}>
                    <span><FaClipboardList style={{marginRight:4}} /></span> Work Order Status Updates
                  </h3>
                  <div style={{display:'grid', gap:12}}>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Work Order Created</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>New work order has been created</div>
                      </div>
                      <input type="checkbox" checked={notifications.workOrderCreated} onChange={() => handleNotificationToggle('workOrderCreated')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Work Started</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Technician has started working on a job</div>
                      </div>
                      <input type="checkbox" checked={notifications.workOrderStarted} onChange={() => handleNotificationToggle('workOrderStarted')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Work Completed</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Work order has been completed</div>
                      </div>
                      <input type="checkbox" checked={notifications.workOrderCompleted} onChange={() => handleNotificationToggle('workOrderCompleted')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Tech Arrived</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Technician has arrived at the location</div>
                      </div>
                      <input type="checkbox" checked={notifications.techArrived} onChange={() => handleNotificationToggle('techArrived')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Tech Leaving</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Technician is leaving the location</div>
                      </div>
                      <input type="checkbox" checked={notifications.techLeaving} onChange={() => handleNotificationToggle('techLeaving')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Estimate Approved</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Customer has approved an estimate</div>
                      </div>
                      <input type="checkbox" checked={notifications.estimateApproved} onChange={() => handleNotificationToggle('estimateApproved')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, cursor:'pointer'}}>
                      <div>
                        <div style={{color:'#e5e7eb', fontWeight:600, marginBottom:4}}>Estimate Rejected</div>
                        <div style={{color:'#9aa3b2', fontSize:13}}>Customer has rejected an estimate</div>
                      </div>
                      <input type="checkbox" checked={notifications.estimateRejected} onChange={() => handleNotificationToggle('estimateRejected')} style={{width:20, height:20, cursor:'pointer'}} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div style={{marginTop:32, paddingTop:24, borderTop:'1px solid rgba(255,255,255,0.1)'}}>
              <button onClick={handleSave} style={{padding:'12px 32px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Service Modal */}
      {showAgreementModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <div style={{ background: '#030303', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 16, maxWidth: 980, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#e5e7eb' }}>FixTray Shop Participation Agreement</div>
                <div style={{ fontSize: 12, color: '#9aa3b2' }}>Read the full agreement text and sign electronically.</div>
              </div>
              <button onClick={() => setShowAgreementModal(false)} style={{ background: 'transparent', border: 'none', color: '#9aa3b2', fontSize: 26, cursor: 'pointer' }}><FaTimes /></button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0, color: '#cbd5e1', fontSize: 12, lineHeight: 1.6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                {agreementDisplayText}
              </pre>
            </div>

            <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.14)', background: 'rgba(0,0,0,0.45)' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>Shop Legal Name</label>
                    <input type="text" value={settings.shopName} readOnly style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: '#e5e7eb', fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>Admin Email</label>
                    <input type="text" value={settings.email} readOnly style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: '#e5e7eb', fontSize: 13 }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>Digital Signature (full legal name)</label>
                  <input
                    type="text"
                    value={agreementSignature}
                    onChange={(e) => setAgreementSignature(e.target.value)}
                    placeholder="Type full legal name"
                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 8, color: '#e5e7eb', fontSize: 14 }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#e5e7eb', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer' }}
                  />
                  <span>I am authorized to bind this Shop and I agree to the FixTray Shop Participation Agreement.</span>
                </label>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {agreementSignedAt ? <div style={{ color: '#9aa3b2', fontSize: 12 }}>Current signed timestamp: {new Date(agreementSignedAt).toLocaleString()}</div> : <div style={{ color: '#9aa3b2', fontSize: 12 }}>Signing will timestamp this agreement in UTC.</div>}
                  <button onClick={handleSignAgreement} style={{ padding: '10px 18px', border: 'none', background: '#22c55e', color: '#fff', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Sign Agreement</button>
                </div>

                {agreementError ? <div style={{ color: '#fca5a5', fontSize: 12 }}>{agreementError}</div> : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddServiceModal && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
          <div style={{background:'#000000', border:'1px solid rgba(255,255,255,0.2)', borderRadius:16, padding:32, maxWidth:500, width:'90%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb'}}>Add New Service</h2>
              <button onClick={() => setShowAddServiceModal(false)} style={{background:'transparent', border:'none', color:'#9aa3b2', fontSize:24, cursor:'pointer', padding:0}}></button>
            </div>

            <div style={{display:'flex', gap:8, marginBottom:16}}>
              <button
                type="button"
                onClick={() => setNewServiceMode('catalog')}
                style={{
                  flex:1,
                  padding:'10px 12px',
                  borderRadius:8,
                  border: newServiceMode === 'catalog' ? '2px solid #e5332a' : '1px solid rgba(255,255,255,0.1)',
                  background: newServiceMode === 'catalog' ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.05)',
                  color:'#e5e7eb',
                  fontWeight:700,
                  cursor:'pointer'
                }}
              >
                Browse Catalog
              </button>
              <button
                type="button"
                onClick={() => setNewServiceMode('custom')}
                style={{
                  flex:1,
                  padding:'10px 12px',
                  borderRadius:8,
                  border: newServiceMode === 'custom' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                  background: newServiceMode === 'custom' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                  color:'#e5e7eb',
                  fontWeight:700,
                  cursor:'pointer'
                }}
              >
                Custom Service
              </button>
            </div>

            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Service Category *</label>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:12}}>
                {CATEGORY_CONFIG.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setNewService({ ...newService, category: cat.id, serviceName: '', customName: '' })}
                    style={{
                      padding:12,
                      background: newService.category === cat.id ? cat.bg : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${newService.category === cat.id ? cat.color : 'rgba(255,255,255,0.1)'}`,
                      borderRadius:8,
                      cursor:'pointer',
                      color:'#e5e7eb',
                      fontSize:13,
                      fontWeight:600,
                      textAlign:'left'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {newServiceMode === 'catalog' ? (
              <div style={{marginBottom:16}}>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Service Name *</label>
                <select 
                  value={newService.serviceName} 
                  onChange={(e) => setNewService({...newService, serviceName: e.target.value, customName: ''})} 
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                >
                  <option value="" disabled>Select a service...</option>
                  {(SERVICE_OPTIONS[newService.category] || []).map(service => (
                    <option key={service} value={service} style={{background:'rgba(0,0,0,0.8)', color:'#e5e7eb'}}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{marginBottom:16}}>
                <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Custom Service Name *</label>
                <input
                  type="text"
                  value={newService.customName}
                  onChange={(e) => setNewService({...newService, customName: e.target.value, serviceName: ''})}
                  placeholder="e.g., Mobile Hydraulic Rescue"
                  style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}}
                />
              </div>
            )}

            <div style={{marginBottom:24}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Price (Optional)</label>
              <input 
                type="number" 
                value={newService.price} 
                onChange={(e) => setNewService({...newService, price: e.target.value})} 
                placeholder="0.00"
                step="0.01"
                style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} 
              />
            </div>

            {serviceMsg && (
              <div style={{ marginBottom: 16, background: serviceMsg.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${serviceMsg.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 8, padding: '8px 14px', color: serviceMsg.type === 'success' ? '#86efac' : '#fca5a5', fontSize: 13, fontWeight: 600 }}>{serviceMsg.text}</div>
            )}
            <div style={{display:'flex', gap:12}}>
              <button 
                onClick={() => setShowAddServiceModal(false)} 
                style={{flex:1, padding:'12px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddService} 
                style={{flex:1, padding:'12px', background:'#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {showEditServiceModal && selectedService && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
          <div style={{background:'#000000', border:'1px solid rgba(255,255,255,0.2)', borderRadius:16, padding:32, maxWidth:600, width:'90%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}>
              <div>
                <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:4}}>{selectedService.serviceName}</h2>
                <span style={{
                  padding:'4px 12px', 
                  background: selectedService.category === 'diesel' ? 'rgba(34,197,94,0.2)' : 'rgba(229,51,42,0.2)', 
                  color: selectedService.category === 'diesel' ? '#22c55e' : '#e5332a', 
                  borderRadius:12, 
                  fontSize:12, 
                  fontWeight:600
                }}>
                  {selectedService.category === 'diesel' ? <><FaTruck style={{marginRight:4}} /> Diesel / Heavy-Duty</> : <><FaCar style={{marginRight:4}} /> Gas / Automotive</>}
                </span>
              </div>
              <button onClick={() => setShowEditServiceModal(false)} style={{background:'transparent', border:'none', color:'#9aa3b2', fontSize:24, cursor:'pointer', padding:0}}></button>
            </div>

            <p style={{color:'#9aa3b2', marginBottom:24, fontSize:14}}>Set labor time and pricing for this service</p>

            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Labor Duration (hours)</label>
              <input 
                type="number" 
                value={editService.duration} 
                onChange={(e) => setEditService({...editService, duration: e.target.value})} 
                placeholder="e.g., 2.5"
                step="0.25"
                style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} 
              />
              <div style={{color:'#6b7280', fontSize:12, marginTop:4}}>Estimated time to complete this service</div>
            </div>

            <div style={{marginBottom:20}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Service Price ($)</label>
              <input 
                type="number" 
                value={editService.price} 
                onChange={(e) => setEditService({...editService, price: e.target.value})} 
                placeholder="0.00"
                step="0.01"
                style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14}} 
              />
              <div style={{color:'#6b7280', fontSize:12, marginTop:4}}>Standard pricing for this service (excluding parts)</div>
            </div>

            <div style={{marginBottom:24}}>
              <label style={{display:'block', fontSize:13, color:'#9aa3b2', marginBottom:8}}>Description / Notes</label>
              <textarea 
                value={editService.description} 
                onChange={(e) => setEditService({...editService, description: e.target.value})} 
                placeholder="Add any notes about this service..."
                rows={3}
                style={{width:'100%', padding:'12px', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#e5e7eb', fontSize:14, resize:'vertical'}} 
              />
            </div>

            <div style={{display:'flex', gap:12}}>
              <button 
                onClick={() => setShowEditServiceModal(false)} 
                style={{flex:1, padding:'12px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateService} 
                style={{flex:1, padding:'12px', background:'#e5332a', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer'}}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings toast */}
      {settingsMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: settingsMsg.type === 'success' ? '#dcfce7' : '#fde8e8', color: settingsMsg.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${settingsMsg.type === 'success' ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '12px 20px', zIndex: 9999, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 420 }}>
          {settingsMsg.text}
          <button onClick={() => setSettingsMsg(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: settingsMsg.type === 'success' ? '#166534' : '#991b1b' }}><FaTimes style={{marginRight:4}} /></button>
        </div>
      )}

      {/* Remove service confirm modal */}
      {removeServiceConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}><FaTrash style={{marginRight:4}} /></div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Remove Service?</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>This service will be removed from your shop catalog.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setRemoveServiceConfirmId(null)} style={{ flex: 1, padding: '10px', background: '#334155', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#e2e8f0' }}>Cancel</button>
              <button onClick={() => handleRemoveService(removeServiceConfirmId)} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopSettingsPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShopSettingsPageContent />
    </Suspense>
  );
}

export default ShopSettingsPageWrapper;


