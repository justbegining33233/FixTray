'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCalendarAlt, FaCheckCircle, FaComments, FaTimesCircle } from 'react-icons/fa';

interface EstimateItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Estimate {
  id: string; // work order id
  status: 'pending' | 'accepted' | 'denied';
  service: string;
  price: number;
  shop: string;
  description: string;
  validUntil: string;
  lineItems?: EstimateItem[];
  vehicle?: {
    make?: string;
    model?: string;
    year?: number;
    vehicleType?: string;
    vin?: string;
  };
  techLabor?: Array<{ description?: string; hours?: number; rate?: number }>;
  partsUsed?: Array<{ name?: string; quantity?: number; unitPrice?: number }>;
}

export default function Estimates() {
  useRequireAuth(['customer']);
  const [userName, setUserName] = useState('');
  const [activeTab, setActiveTab] = useState('my-estimates');
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [requestServices, setRequestServices] = useState<string[]>([]);
  const [requestForm, setRequestForm] = useState({
    shopId: '',
    serviceType: '',
    description: '',
  });
  const [estimateMsg, setEstimateMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  const fetchEstimates = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/workorders?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) return;
      const data = await response.json();
      const workOrders = data.workOrders || [];

      // Map work orders with estimates to our Estimate format
      const mapped: Estimate[] = workOrders
        .filter((wo: any) => wo.estimate || wo.estimatedCost || wo.status === 'estimate-submitted')
        .map((wo: any) => {
          const est = wo.estimate || {};
          let status: 'pending' | 'accepted' | 'denied' = 'pending';
          if (wo.status === 'denied-estimate') status = 'denied';
          else if (['in-progress', 'assigned', 'closed', 'waiting-for-payment'].includes(wo.status)) status = 'accepted';
          // estimate-submitted stays as 'pending'

          const symptoms = typeof wo.issueDescription === 'object' && wo.issueDescription !== null
            ? (wo.issueDescription as any).symptoms || JSON.stringify(wo.issueDescription)
            : String(wo.issueDescription || '');

          const techLabor = Array.isArray(wo.techLabor) ? wo.techLabor : [];
          const partsUsed = Array.isArray(wo.partsUsed) ? wo.partsUsed : [];
          const miscItems = Array.isArray(est.lineItems) ? est.lineItems : [];

          return {
            id: wo.id,
            status,
            service: symptoms.slice(0, 80) || 'Service',
            price: est.total || wo.estimatedCost || 0,
            shop: wo.shop?.shopName || 'Shop',
            description: symptoms,
            validUntil: wo.updatedAt || wo.createdAt,
            lineItems: miscItems,
            vehicle: wo.vehicle ? {
              make: wo.vehicle.make,
              model: wo.vehicle.model,
              year: wo.vehicle.year,
              vehicleType: wo.vehicle.vehicleType || wo.vehicleType,
              vin: wo.vehicle.vin,
            } : { vehicleType: wo.vehicleType },
            techLabor,
            partsUsed,
          };
        });

      setEstimates(mapped);
    } catch (error) {
      console.error('Error fetching estimates:', error);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    fetchEstimates();
  }, [fetchEstimates]);

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/shops/accepted', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (response.ok) {
          const data = await response.json();
          setShops(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching shops:', error);
      }
    };

    fetchShops();
  }, []);

  useEffect(() => {
    const selectedShop = shops.find((shop) => shop.id === requestForm.shopId);

    if (!selectedShop) {
      setRequestServices([]);
      setRequestForm((prev) => ({ ...prev, serviceType: '' }));
      return;
    }

    const names = [
      ...((selectedShop.dieselServices || []) as Array<{ serviceName?: string }>),
      ...((selectedShop.gasServices || []) as Array<{ serviceName?: string }>),
    ]
      .map((service) => (service?.serviceName || '').trim())
      .filter((serviceName) => serviceName.length > 0);

    const uniqueNames = Array.from(new Set(names));
    setRequestServices(uniqueNames);
    setRequestForm((prev) => ({
      ...prev,
      serviceType: uniqueNames.includes(prev.serviceType) ? prev.serviceType : (uniqueNames[0] || ''),
    }));
  }, [requestForm.shopId, shops]);

  const handleAccept = async (estimateId: string) => {
    setLoading(estimateId);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setEstimateMsg({type:'error',text:'Authentication required'});
        return;
      }

      const response = await fetch(`/api/workorders/${estimateId}/respond-estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ response: 'accepted' }),
      });

      if (response.ok) {
        setEstimates(prev => prev.map(est =>
          est.id === estimateId ? { ...est, status: 'accepted' as const } : est
        ));
        setEstimateMsg({type:'success',text:'Estimate accepted! The shop has been notified and will begin work.'});
      } else {
        const error = await response.json();
        setEstimateMsg({type:'error',text:`Error: ${error.error}`});
      }
    } catch (error) {
      console.error('Error accepting estimate:', error);
      setEstimateMsg({type:'error',text:'Failed to accept estimate. Please try again.'});
    } finally {
      setLoading(null);
    }
  };

  const handleDeny = async (estimateId: string) => {
    setLoading(estimateId);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setEstimateMsg({type:'error',text:'Authentication required'});
        return;
      }

      const response = await fetch(`/api/workorders/${estimateId}/respond-estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ response: 'denied' }),
      });

      if (response.ok) {
        setEstimates(prev => prev.map(est =>
          est.id === estimateId ? { ...est, status: 'denied' as const } : est
        ));
        setEstimateMsg({type:'success',text:'Estimate denied. The shop has been notified.'});
      } else {
        const error = await response.json();
        setEstimateMsg({type:'error',text:`Error: ${error.error}`});
      }
    } catch (error) {
      console.error('Error denying estimate:', error);
      setEstimateMsg({type:'error',text:'Failed to deny estimate. Please try again.'});
    } finally {
      setLoading(null);
    }
  };

  // Request a new estimate from the shop/manager for a denied estimate
  const handleRequestEstimate = async (estimate: Estimate) => {
    setLoading(estimate.id);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setEstimateMsg({type:'error',text:'Authentication required'});
        return;
      }

      const body = {
        workOrderId: estimate.id, // when real data includes workOrderId use that
        message: `Customer requested a new estimate for ${estimate.service}`,
      };

      const response = await fetch('/api/customers/estimates/request-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setEstimateMsg({type:'success',text:'Request sent to shop manager successfully!'});
      } else {
        const err = await response.json();
        setEstimateMsg({type:'error',text:`Failed to request new estimate: ${err.error || 'unknown'}`});
      }
    } catch (error) {
      console.error('Error requesting new estimate:', error);
      setEstimateMsg({type:'error',text:'Failed to request new estimate. Please try again.'});
    } finally {
      setLoading(null);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>My Estimates</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <span style={{fontSize:14, color:'#9aa3b2'}}>Welcome, {userName}</span>
          <button onClick={handleSignOut} style={{padding:'8px 16px', background:'#e5332a', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600}}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        {/* Tab Navigation */}
        <div style={{marginBottom:32}}>
          <div style={{display:'flex', gap:8, borderBottom:'2px solid rgba(255,255,255,0.1)', paddingBottom:2, overflowX:'auto'}}>
            <button
              onClick={() => setActiveTab('my-estimates')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'my-estimates' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'my-estimates' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'my-estimates' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              MY ESTIMATES
            </button>
            <button
              onClick={() => setActiveTab('request-estimate')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'request-estimate' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'request-estimate' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'request-estimate' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              REQUEST ESTIMATE
            </button>
            <button
              onClick={() => setActiveTab('denied-estimates')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'denied-estimates' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'denied-estimates' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'denied-estimates' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              DENIED ESTIMATES
            </button>
            <button
              onClick={() => setActiveTab('approved-estimates')}
              style={{
                padding:'12px 24px',
                background: activeTab === 'approved-estimates' ? 'rgba(229,51,42,0.2)' : 'transparent',
                border:'none',
                borderBottom: activeTab === 'approved-estimates' ? '3px solid #e5332a' : '3px solid transparent',
                color: activeTab === 'approved-estimates' ? '#e5332a' : '#9aa3b2',
                cursor:'pointer',
                fontSize:15,
                fontWeight:700,
                transition:'all 0.2s',
                borderRadius:'8px 8px 0 0',
                whiteSpace:'nowrap'
              }}
            >
              APPROVED ESTIMATES
            </button>
          </div>
        </div>
        {/* Tab Content */}
        {fetching ? (
          <div style={{textAlign:'center', padding:60, color:'#9aa3b2'}}>
            <div style={{fontSize:18, fontWeight:600, marginBottom:8}}>Loading estimates...</div>
          </div>
        ) : (<>
        {activeTab === 'my-estimates' && (
          <div>
            <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>My Estimates</h1>
            <p style={{fontSize:16, color:'#9aa3b2', marginBottom:24}}>Review and respond to pending estimate requests from shops</p>

            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:24}}>
              {estimates.filter(estimate => estimate.status === 'pending').map(estimate => (
                <div key={estimate.id} style={{
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:12,
                  padding:24
                }}>
                  <div style={{marginBottom:16}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                      <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', margin:0}}>{estimate.shop}</h3>
                      <span style={{padding:'4px 12px', background:'rgba(245,158,11,0.2)', color:'#f59e0b', borderRadius:12, fontSize:12, fontWeight:600}}>
                        PENDING REVIEW
                      </span>
                    </div>
                    <div style={{fontSize:24, color:'#e5332a', fontWeight:800, marginBottom:4}}>${estimate.price.toFixed(2)}</div>
                    <div style={{fontSize:13, color:'#9aa3b2'}}>
                      Submitted {new Date(estimate.validUntil).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}
                    </div>
                  </div>

                  {/* Expand / collapse full work order details */}
                  <button
                    onClick={() => setExpandedId(expandedId === estimate.id ? null : estimate.id)}
                    style={{width:'100%', marginBottom:12, padding:'8px 0', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#9aa3b2', fontSize:13, fontWeight:600, cursor:'pointer'}}
                  >
                    {expandedId === estimate.id ? '▲ Hide Details' : '▼ View Full Work Order Details'}
                  </button>

                  {expandedId === estimate.id && (
                    <div style={{marginBottom:16, background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:16}}>
                      {/* Vehicle */}
                      {estimate.vehicle && (
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6}}>Vehicle</div>
                          <div style={{fontSize:14, color:'#e5e7eb'}}>
                            {[estimate.vehicle.year, estimate.vehicle.make, estimate.vehicle.model].filter(Boolean).join(' ') || estimate.vehicle.vehicleType || '—'}
                            {estimate.vehicle.vin && <span style={{fontSize:12, color:'#6b7280', marginLeft:8}}>VIN: {estimate.vehicle.vin}</span>}
                          </div>
                        </div>
                      )}

                      {/* Issue */}
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6}}>Issue / Service</div>
                        <div style={{fontSize:13, color:'#e5e7eb', lineHeight:1.6, whiteSpace:'pre-wrap'}}>{estimate.description || '—'}</div>
                      </div>

                      {/* Line Items */}
                      {((estimate.techLabor?.length ?? 0) + (estimate.partsUsed?.length ?? 0) + (estimate.lineItems?.length ?? 0)) > 0 && (
                        <div>
                          <div style={{fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>Estimate Breakdown</div>
                          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                            <thead>
                              <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                                <th style={{textAlign:'left', padding:'4px 6px', color:'#6b7280', fontSize:11, fontWeight:700}}>Description</th>
                                <th style={{textAlign:'right', padding:'4px 6px', color:'#6b7280', fontSize:11, fontWeight:700}}>Qty</th>
                                <th style={{textAlign:'right', padding:'4px 6px', color:'#6b7280', fontSize:11, fontWeight:700}}>Rate</th>
                                <th style={{textAlign:'right', padding:'4px 6px', color:'#6b7280', fontSize:11, fontWeight:700}}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {estimate.techLabor?.map((item, i) => (
                                <tr key={`labor-${i}`} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb'}}>{item.description || 'Labor'} <span style={{fontSize:10, color:'#60a5fa', marginLeft:4}}>LABOR</span></td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right'}}>{item.hours ?? 1}</td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right'}}>${(item.rate ?? 0).toFixed(2)}/hr</td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right', fontWeight:600}}>${((item.hours ?? 1) * (item.rate ?? 0)).toFixed(2)}</td>
                                </tr>
                              ))}
                              {estimate.partsUsed?.map((item, i) => (
                                <tr key={`part-${i}`} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb'}}>{item.name || 'Part'} <span style={{fontSize:10, color:'#a78bfa', marginLeft:4}}>PART</span></td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right'}}>{item.quantity ?? 1}</td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right'}}>${(item.unitPrice ?? 0).toFixed(2)}</td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right', fontWeight:600}}>${((item.quantity ?? 1) * (item.unitPrice ?? 0)).toFixed(2)}</td>
                                </tr>
                              ))}
                              {estimate.lineItems?.map((item, i) => (
                                <tr key={`misc-${i}`} style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb'}}>{item.description || 'Misc'}</td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right'}}>{item.quantity}</td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right'}}>${item.unitPrice.toFixed(2)}</td>
                                  <td style={{padding:'5px 6px', color:'#e5e7eb', textAlign:'right', fontWeight:600}}>${item.total.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{borderTop:'2px solid rgba(255,255,255,0.12)'}}>
                                <td colSpan={3} style={{padding:'8px 6px', fontWeight:700, color:'#e5e7eb', textAlign:'right'}}>TOTAL</td>
                                <td style={{padding:'8px 6px', fontWeight:800, color:'#22c55e', textAlign:'right', fontSize:15}}>${estimate.price.toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{display:'flex', gap:12}}>
                    <button
                      onClick={() => handleAccept(estimate.id)}
                      disabled={loading === estimate.id}
                      style={{flex:1, padding:'12px', background: loading === estimate.id ? '#16a34a' : '#22c55e', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor: loading === estimate.id ? 'not-allowed' : 'pointer', opacity: loading === estimate.id ? 0.7 : 1}}
                    >
                      {loading === estimate.id ? 'Processing...' : <><FaCheckCircle style={{marginRight:4}} /> Accept Estimate</>}
                    </button>
                    <button
                      onClick={() => handleDeny(estimate.id)}
                      disabled={loading === estimate.id}
                      style={{flex:1, padding:'12px', background: loading === estimate.id ? '#dc2626' : '#ef4444', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor: loading === estimate.id ? 'not-allowed' : 'pointer', opacity: loading === estimate.id ? 0.7 : 1}}
                    >
                      {loading === estimate.id ? 'Processing...' : <><FaTimesCircle style={{marginRight:4}} /> Deny Estimate</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {estimates.filter(estimate => estimate.status === 'pending').length === 0 && (
              <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
                No pending estimates to review
              </div>
            )}
          </div>
        )}

        {activeTab === 'request-estimate' && (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32}}>
              <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb'}}>Request Estimate</h1>
              <button style={{
                padding:'12px 24px',
                background:'#e5332a',
                color:'white',
                border:'none',
                borderRadius:8,
                fontSize:16,
                fontWeight:600,
                cursor:'pointer'
              }}>
                Submit Request
              </button>
            </div>
            <div style={{maxWidth:600, margin:'0 auto'}}>
              <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:32}}>
                <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:24}}>Request a New Estimate</h2>
                <div style={{display:'grid', gap:20}}>
                  <div>
                    <label style={{display:'block', fontSize:14, fontWeight:600, color:'#e5e7eb', marginBottom:8}}>Service Type</label>
                    <select
                      value={requestForm.serviceType}
                      onChange={(e) => setRequestForm({ ...requestForm, serviceType: e.target.value })}
                      disabled={!requestForm.shopId || requestServices.length === 0}
                      style={{
                      width:'100%',
                      padding:'12px',
                      background:'rgba(255,255,255,0.1)',
                      border:'1px solid rgba(255,255,255,0.2)',
                      borderRadius:8,
                      color:'#e5e7eb',
                      fontSize:16
                    }}>
                      {!requestForm.shopId && <option value="">Select a shop first</option>}
                      {requestForm.shopId && requestServices.length === 0 && <option value="">No services configured for this shop</option>}
                      {requestServices.map((serviceName) => (
                        <option key={serviceName} value={serviceName}>{serviceName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{display:'block', fontSize:14, fontWeight:600, color:'#e5e7eb', marginBottom:8}}>Description</label>
                    <textarea 
                      value={requestForm.description}
                      onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                      placeholder="Describe the service you need..."
                      style={{
                        width:'100%',
                        padding:'12px',
                        background:'rgba(255,255,255,0.1)',
                        border:'1px solid rgba(255,255,255,0.2)',
                        borderRadius:8,
                        color:'#e5e7eb',
                        fontSize:16,
                        minHeight:100,
                        resize:'vertical'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{display:'block', fontSize:14, fontWeight:600, color:'#e5e7eb', marginBottom:8}}>Preferred Shop (Optional)</label>
                    <select
                      value={requestForm.shopId}
                      onChange={(e) => setRequestForm({ ...requestForm, shopId: e.target.value })}
                      style={{
                      width:'100%',
                      padding:'12px',
                      background:'rgba(255,255,255,0.1)',
                      border:'1px solid rgba(255,255,255,0.2)',
                      borderRadius:8,
                      color:'#e5e7eb',
                      fontSize:16
                    }}>
                      <option value="">Any available shop</option>
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.shopName || shop.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'denied-estimates' && (
          <div>
            <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>Denied Estimates</h1>
            <p style={{fontSize:16, color:'#9aa3b2', marginBottom:24}}>Estimates you have declined</p>

            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:24}}>
              {estimates.filter(estimate => estimate.status === 'denied').map(estimate => (
                <div key={estimate.id} style={{
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:12,
                  padding:24,
                  opacity: 0.7
                }}>
                  <div style={{marginBottom:20}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                      <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{estimate.service}</h3>
                      <span style={{
                        padding:'4px 12px',
                        background: 'rgba(239,68,68,0.2)',
                        color: '#ef4444',
                        borderRadius:12,
                        fontSize:12,
                        fontWeight:600
                      }}>
                        {estimate.status}
                      </span>
                    </div>
                    <div style={{fontSize:18, color:'#6b7280', fontWeight:700, marginBottom:8, textDecoration:'line-through'}}>${estimate.price.toFixed(2)}</div>
                    <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{estimate.shop}</div>
                    <div style={{fontSize:14, color:'#e5e7eb', lineHeight:1.5, marginBottom:12}}>{estimate.description}</div>
                    <div style={{fontSize:12, color:'#6b7280'}}>Denied on: {estimate.validUntil}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <button onClick={() => handleRequestEstimate(estimate)} disabled={loading === estimate.id} style={{
                      padding:'8px 16px',
                      background: loading === estimate.id ? 'rgba(229,51,42,0.06)' : 'rgba(229,51,42,0.1)',
                      color:'#e5332a',
                      border:'1px solid rgba(229,51,42,0.3)',
                      borderRadius:8,
                      fontSize:12,
                      fontWeight:600,
                      cursor: loading === estimate.id ? 'not-allowed' : 'pointer'
                    }}>
                      {loading === estimate.id ? 'Requesting...' : 'Request New Estimate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {estimates.filter(estimate => estimate.status === 'denied').length === 0 && (
              <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
                No denied estimates
              </div>
            )}
          </div>
        )}

        {activeTab === 'approved-estimates' && (
          <div>
            <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>Approved Estimates</h1>
            <p style={{fontSize:16, color:'#9aa3b2', marginBottom:24}}>Estimates you have accepted and approved</p>

            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:24}}>
              {estimates.filter(estimate => estimate.status === 'accepted').map(estimate => (
                <div key={estimate.id} style={{
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:12,
                  padding:24
                }}>
                  <div style={{marginBottom:20}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                      <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{estimate.service}</h3>
                      <span style={{
                        padding:'4px 12px',
                        background: 'rgba(34,197,94,0.2)',
                        color: '#22c55e',
                        borderRadius:12,
                        fontSize:12,
                        fontWeight:600
                      }}>
                        {estimate.status}
                      </span>
                    </div>
                    <div style={{fontSize:18, color:'#22c55e', fontWeight:700, marginBottom:8}}>${estimate.price.toFixed(2)}</div>
                    <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{estimate.shop}</div>
                    <div style={{fontSize:14, color:'#e5e7eb', lineHeight:1.5, marginBottom:12}}>{estimate.description}</div>
                    <div style={{fontSize:12, color:'#6b7280'}}>Approved on: {estimate.validUntil}</div>
                  </div>
                  <div style={{display:'flex', gap:12}}>
                    <button style={{
                      flex:1,
                      padding:'12px',
                      background:'#e5332a',
                      color:'white',
                      border:'none',
                      borderRadius:8,
                      fontSize:14,
                      fontWeight:600,
                      cursor:'pointer'
                    }}>
                      <FaCalendarAlt style={{marginRight:4}} /> Schedule Service
                    </button>
                    <button style={{
                      flex:1,
                      padding:'12px',
                      background:'rgba(245,158,11,0.1)',
                      color:'#f59e0b',
                      border:'1px solid rgba(245,158,11,0.3)',
                      borderRadius:8,
                      fontSize:14,
                      fontWeight:600,
                      cursor:'pointer'
                    }}>
                      <FaComments style={{marginRight:4}} /> Contact Shop
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {estimates.filter(estimate => estimate.status === 'accepted').length === 0 && (
              <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
                No approved estimates yet
              </div>
            )}
          </div>
        )}
        </>)}

        {/* Back to Dashboard */}
        <div style={{marginTop:32, textAlign:'center'}}>
          <Link href="/customer/dashboard" style={{
            padding:'12px 24px',
            background:'#e5332a',
            color:'white',
            border:'none',
            borderRadius:8,
            fontSize:16,
            fontWeight:600,
            textDecoration:'none',
            cursor:'pointer'
          }}>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {estimateMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:estimateMsg.type==='success'?'#dcfce7':'#fde8e8',color:estimateMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {estimateMsg.text}
          <button onClick={()=>setEstimateMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}
