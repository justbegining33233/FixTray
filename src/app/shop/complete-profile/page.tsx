'use client';

import { useState } from 'react';
import { FaArrowRight, FaCreditCard, FaLink } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import useRequireAuth from '@/lib/useRequireAuth';

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

const CATEGORY_CONFIG: Array<{ id: CategoryId; label: string; note?: string }> = [
  { id: 'diesel', label: 'Diesel / Heavy-Duty Services' },
  { id: 'gas', label: 'Gas / Automotive Services' },
  { id: 'small-engine', label: 'Small Engine Services' },
  { id: 'heavy-equipment', label: 'Heavy Equipment Services' },
  { id: 'resurfacing', label: 'Resurfacing / Machining' },
  { id: 'welding', label: 'Welding & Fabrication' },
  { id: 'tire', label: 'Tire Shop Services' },
];

const FIXTRAY_AGREEMENT_VERSION = '2026-06-01';

export default function CompleteProfile() {
  const { user, isLoading: _isLoading } = useRequireAuth(['shop']);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState({
    businessLicense: '',
    insurancePolicy: '',
    numberOfBays: 1,
    shopType: 'diesel' as 'diesel' | 'gas' | 'small-engine' | 'heavy-equipment' | 'resurfacing' | 'welding' | 'tire' | 'mixed',
    dieselServices: [] as string[],
    gasServices: [] as string[],
    smallEngineServices: [] as string[],
    heavyEquipmentServices: [] as string[],
    resurfacingServices: [] as string[],
    weldingServices: [] as string[],
    tireServices: [] as string[],
    agreementAccepted: false,
    agreementSignature: '',
  });

  const handleServiceToggle = (service: string, category: CategoryId) => {
    const keyMap: Record<CategoryId, keyof typeof formData> = {
      diesel: 'dieselServices',
      gas: 'gasServices',
      'small-engine': 'smallEngineServices',
      'heavy-equipment': 'heavyEquipmentServices',
      resurfacing: 'resurfacingServices',
      welding: 'weldingServices',
      tire: 'tireServices',
    };

    const key = keyMap[category];
    setFormData((prev) => {
      const current = prev[key] as string[];
      const next = current.includes(service) ? current.filter((s) => s !== service) : [...current, service];
      const updated = { ...prev, [key]: next };
      return { ...updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    // Validation
    if (!formData.businessLicense.trim()) {
      setSubmitError('Please enter your business license number');
      return;
    }
    
    if (!formData.insurancePolicy.trim()) {
      setSubmitError('Please enter your insurance policy number');
      return;
    }

    const totalSelected =
      formData.dieselServices.length +
      formData.gasServices.length +
      formData.smallEngineServices.length +
      formData.heavyEquipmentServices.length +
      formData.resurfacingServices.length +
      formData.weldingServices.length +
      formData.tireServices.length;

    if (totalSelected === 0) {
      setSubmitError('Please select at least one service');
      return;
    }

    const requiredByType: Record<CategoryId | 'mixed', number> = {
      diesel: formData.dieselServices.length,
      gas: formData.gasServices.length,
      'small-engine': formData.smallEngineServices.length,
      'heavy-equipment': formData.heavyEquipmentServices.length,
      resurfacing: formData.resurfacingServices.length,
      welding: formData.weldingServices.length,
      tire: formData.tireServices.length,
      mixed: totalSelected,
    };

    if (!requiredByType[formData.shopType]) {
      setSubmitError('Please select at least one service in your chosen shop category');
      return;
    }

    if (!formData.agreementAccepted || !formData.agreementSignature.trim()) {
      setSubmitError('You must accept and sign the FixTray agreement before continuing.');
      return;
    }

    setSubmitting(true);

    try {
      const shopId = user?.shopId || localStorage.getItem('shopId');
      if (!shopId) {
        setSubmitError('Missing shop session. Please log in as your shop account and try again.');
        setSubmitting(false);
        return;
      }

      // Obtain CSRF token (double-submit) similar to registration flow
      await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
      const csrf = typeof document !== 'undefined' ? document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrf_token='))?.split('=')[1] : null;
      const response = await fetch('/api/shops/complete-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf || '' },
        body: JSON.stringify({
          shopId,
          ...formData,
          agreementVersion: FIXTRAY_AGREEMENT_VERSION,
        }),
      });

      if (response.ok) {
        // Mark profile as complete in localStorage
        localStorage.setItem('shopProfileComplete', 'true');
        localStorage.setItem('fixtrayAgreementAccepted', 'true');
        setStep(2);
      } else {
        let errorMessage = 'Failed to complete profile';
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || error.detail || error.errorMessage || errorMessage;
        } catch {
          // ignore
        }
        console.error('Complete profile failed', { status: response.status, errorMessage });
        setSubmitError(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error completing profile:', error);
      setSubmitError('Failed to complete profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const [stripeLoading, setStripeLoading] = useState(false);

  const handleConnectStripe = async () => {
    setStripeLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/stripe/connect?from=onboarding', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setSubmitError(data.error || 'Failed to start Stripe Connect. Please try again.');
        setStripeLoading(false);
      }
    } catch {
      setSubmitError('Failed to connect to Stripe. Please try again.');
      setStripeLoading(false);
    }
  };

  if (step === 2) {
    const _token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return (
      <div style={{minHeight:'100vh', background: 'transparent'}}>
        <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <Link href="/" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>Step 2 of 2  -  Connect Payout Account (Optional)</div>
        </div>
        <div style={{maxWidth:600, margin:'0 auto', padding:48}}>
          <div style={{background:'rgba(0,0,0,0.2)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:16, padding:40, textAlign:'center'}}>
            <div style={{fontSize:56, marginBottom:16}}><FaCreditCard /></div>
            <h2 style={{fontSize:26, fontWeight:800, color:'#e5e7eb', marginBottom:12}}>Connect Your Stripe Account</h2>
            <p style={{color:'#9aa3b2', fontSize:15, marginBottom:8, lineHeight:1.6}}>
              Connect your Stripe account to receive customer payments directly into your bank account. You can do this later from your settings.
            </p>
            <p style={{color:'#9aa3b2', fontSize:14, marginBottom:32, lineHeight:1.6}}>
              When a customer pays a work order, Stripe sends the full repair amount straight to you. FixTray only collects a separate $5 service fee added on top  -  your money never passes through us.
            </p>
            <button
              onClick={handleConnectStripe}
              disabled={stripeLoading}
              style={{
                display:'block',
                width:'100%',
                padding:'16px 32px',
                background: stripeLoading ? '#4b4b8f' : '#635bff',
                color:'white',
                borderRadius:10,
                fontSize:16,
                fontWeight:700,
                border:'none',
                cursor: stripeLoading ? 'not-allowed' : 'pointer',
                marginBottom:12,
              }}
            >
              {stripeLoading ? 'Connecting...' : <><FaLink style={{marginRight:8}} />Connect with Stripe</>}
            </button>
            <button
              onClick={() => { router.push('/shop/admin' as Route); }}
              style={{
                display:'block',
                width:'100%',
                padding:'12px 32px',
                background:'transparent',
                color:'#9aa3b2',
                borderRadius:10,
                fontSize:14,
                fontWeight:600,
                border:'1px solid rgba(255,255,255,0.1)',
                cursor:'pointer',
                marginBottom:16,
              }}
            >
              Skip for now <FaArrowRight style={{marginRight:4}} />
            </button>
            <p style={{color:'#6b7280', fontSize:12}}>
              You'll be taken to Stripe's secure onboarding. Once complete you'll be redirected back to your dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <Link href="/" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
        <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>Step 1 of 2  -  Complete Your Shop Profile</div>
      </div>

      <div style={{maxWidth:900, margin:'0 auto', padding:32}}>
        <div style={{background:'rgba(0,0,0,0.2)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:12, padding:32}}>
          <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>
            Welcome! Let's Complete Your Shop Profile
          </h1>
          <p style={{color:'#9aa3b2', marginBottom:32}}>
            Please provide the following information to activate your shop account. Choose one of the seven shop categories below.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Business License */}
            <div style={{marginBottom:24}}>
              <label style={{display:'block', color:'#e5e7eb', fontWeight:600, marginBottom:8}}>
                Business License Number <span style={{color:'#e5332a'}}>*</span>
              </label>
              <input
                type="text"
                value={formData.businessLicense}
                onChange={(e) => setFormData({...formData, businessLicense: e.target.value})}
                placeholder="Enter your business license number"
                style={{
                  width:'100%',
                  padding:'12px 16px',
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(229,51,42,0.3)',
                  borderRadius:8,
                  color:'#e5e7eb',
                  fontSize:14
                }}
                required
              />
            </div>

            {/* Insurance Policy */}
            <div style={{marginBottom:24}}>
              <label style={{display:'block', color:'#e5e7eb', fontWeight:600, marginBottom:8}}>
                Insurance Policy Number <span style={{color:'#e5332a'}}>*</span>
              </label>
              <input
                type="text"
                value={formData.insurancePolicy}
                onChange={(e) => setFormData({...formData, insurancePolicy: e.target.value})}
                placeholder="Enter your insurance policy number"
                style={{
                  width:'100%',
                  padding:'12px 16px',
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(229,51,42,0.3)',
                  borderRadius:8,
                  color:'#e5e7eb',
                  fontSize:14
                }}
                required
              />
            </div>

            {/* Number of Bays */}
            <div style={{marginBottom:24}}>
              <label style={{display:'block', color:'#e5e7eb', fontWeight:600, marginBottom:8}}>
                Number of Service Bays <span style={{color:'#e5332a'}}>*</span>
              </label>
              <p style={{color:'#9aa3b2', fontSize:13, marginBottom:8}}>
                How many vehicles can you work on at the same time? This determines bay availability in your shop overview.
              </p>
              <input
                type="number"
                min={1}
                max={99}
                value={formData.numberOfBays}
                onChange={(e) => setFormData({...formData, numberOfBays: parseInt(e.target.value) || 1})}
                style={{
                  width:120,
                  padding:'12px 16px',
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(229,51,42,0.3)',
                  borderRadius:8,
                  color:'#e5e7eb',
                  fontSize:22,
                  fontWeight:700,
                  textAlign:'center'
                }}
                required
              />
            </div>

            {/* Shop Type */}
            <div style={{marginBottom:24}}>
              <label style={{display:'block', color:'#e5e7eb', fontWeight:600, marginBottom:8}}>
                Shop Type <span style={{color:'#e5332a'}}>*</span>
              </label>
              <select
                value={formData.shopType}
                onChange={(e) => setFormData({...formData, shopType: e.target.value as any})}
                style={{
                  width:'100%',
                  padding:'12px 16px',
                  background:'#1a1a2e',
                  border:'1px solid rgba(229,51,42,0.3)',
                  borderRadius:8,
                  color:'#e5e7eb',
                  fontSize:14,
                  colorScheme:'dark'
                }}
              >
                <option value="diesel">Diesel / Heavy-Duty Services</option>
                <option value="gas">Gas / Automotive Services</option>
                <option value="small-engine">Small Engine Services</option>
                <option value="heavy-equipment">Heavy Equipment Services</option>
                <option value="resurfacing">Resurfacing / Machining</option>
                <option value="welding">Welding & Fabrication</option>
                <option value="tire">Tire Shop Services</option>
                <option value="mixed">Mixed / Multi-Category</option>
              </select>
            </div>

            {/* Services by category */}
            <div style={{display:'grid', gap:24, marginBottom:32}}>
              {CATEGORY_CONFIG.map((cat) => {
                const options = SERVICE_OPTIONS[cat.id] || [];
                const selectedMap: Record<CategoryId, string[]> = {
                  diesel: formData.dieselServices,
                  gas: formData.gasServices,
                  'small-engine': formData.smallEngineServices,
                  'heavy-equipment': formData.heavyEquipmentServices,
                  resurfacing: formData.resurfacingServices,
                  welding: formData.weldingServices,
                  tire: formData.tireServices,
                };
                const selected = selectedMap[cat.id] || [];

                return (
                  <div key={cat.id}>
                    <label style={{display:'block', color:'#e5e7eb', fontWeight:600, marginBottom:12}}>
                      {cat.label} <span style={{color:'#e5332a'}}>*</span>
                    </label>
                    <div style={{
                      background:'rgba(0,0,0,0.3)',
                      border:'1px solid rgba(229,51,42,0.3)',
                      borderRadius:8,
                      padding:20,
                      maxHeight:300,
                      overflowY:'auto'
                    }}>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:12}}>
                        {options.map((service) => (
                          <label key={service} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', color:'#e5e7eb'}}>
                            <input
                              type="checkbox"
                              checked={selected.includes(service)}
                              onChange={() => handleServiceToggle(service, cat.id)}
                              style={{cursor:'pointer'}}
                            />
                            <span style={{fontSize:14}}>{service}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, background: 'rgba(229,51,42,0.10)', border: '1px solid rgba(229,51,42,0.35)' }}>
              <label style={{display:'block', color:'#e5e7eb', fontWeight:600, marginBottom:8}}>
                FixTray Shop Agreement <span style={{color:'#e5332a'}}>*</span>
              </label>
              <p style={{ color: '#9aa3b2', fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
                By signing, you confirm your shop details are accurate, you are authorized to operate this business,
                and you agree to use FixTray in compliance with applicable laws and customer data requirements.
              </p>
              <p style={{ color: '#9aa3b2', fontSize: 12, marginBottom: 12 }}>
                Agreement version: {FIXTRAY_AGREEMENT_VERSION}
              </p>
              <label style={{display:'flex', alignItems:'center', gap:8, color:'#e5e7eb', marginBottom:12, cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={formData.agreementAccepted}
                  onChange={(e) => setFormData({...formData, agreementAccepted: e.target.checked})}
                  style={{cursor:'pointer'}}
                />
                I have read and accept the FixTray Shop Agreement.
              </label>
              <input
                type="text"
                value={formData.agreementSignature}
                onChange={(e) => setFormData({...formData, agreementSignature: e.target.value})}
                placeholder="Type your full legal name as your digital signature"
                style={{
                  width:'100%',
                  padding:'12px 16px',
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(229,51,42,0.3)',
                  borderRadius:8,
                  color:'#e5e7eb',
                  fontSize:14
                }}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width:'100%',
                padding:'14px 24px',
                background: submitting ? '#666' : '#e5332a',
                color:'white',
                border:'none',
                borderRadius:8,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize:16,
                fontWeight:700
              }}
            >
              {submitting ? 'Completing Profile...' : 'Complete Profile & Continue'}
            </button>
            {submitError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', marginTop: 12, color: '#ef4444', fontSize: 14 }}>
                {submitError}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
