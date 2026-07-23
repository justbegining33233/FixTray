'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

interface Shop {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  status: string;
  activityStatus: 'active' | 'inactive';
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  rating: number;
  techCount: number;
  activeTechs: number;
  lastLogin?: string;
}

export default function ShopDetailsPage() {
  const { user, isLoading } = useRequireAuth(['admin', 'superadmin']);
  const router = useRouter();
  const params = useParams();
  const shopId = params?.id as string;

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Shop>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !shopId) return;
    loadShopDetails();
  }, [user, shopId]);

  const loadShopDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch shop details');
      }

      const data = await res.json();
      setShop(data.shop);
      setEditData(data.shop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shop details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editData),
      });

      if (!res.ok) throw new Error('Failed to update shop');
      const data = await res.json();
      setShop(data.shop);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!shop) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setShop(data.shop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
        <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
          <div style={{ flex: 1, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>
            Loading shop details...
          </div>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
        <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
          <main style={{ flex: 1, padding: '24px' }}>
            <div style={{ color: '#ef4444', marginBottom: '24px' }}>
              {error || 'Shop not found'}
            </div>
            <button
              onClick={() => router.back()}
              style={{
                background: '#374151',
                color: '#e5e7eb',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FaArrowLeft /> Go Back
            </button>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => router.back()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 20,
                }}
              >
                <FaArrowLeft />
              </button>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>
                {shop.name}
              </h1>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                background: isEditing ? '#374151' : '#e5332a',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
              }}
            >
              {isEditing ? <FaTimes /> : <FaEdit />}
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              padding: '12px 16px',
              color: '#fca5a5',
              marginBottom: '24px',
            }}>
              {error}
            </div>
          )}

          {/* Shop Status */}
          <div style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: 12,
            padding: '24px',
            marginBottom: '24px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Status
                </label>
                <select
                  value={shop.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  style={{
                    background: '#1f2937',
                    color: '#e5e7eb',
                    border: '1px solid #374151',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 14,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Activity
                </label>
                <div style={{
                  background: shop.activityStatus === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                  color: shop.activityStatus === 'active' ? '#22c55e' : '#9ca3af',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'center',
                }}>
                  {shop.activityStatus === 'active' ? '✓ Active' : '⏱ Inactive'}
                </div>
              </div>

              <div>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Rating
                </label>
                <div style={{
                  background: '#1f2937',
                  color: '#fbbf24',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: 'center',
                }}>
                  {shop.rating.toFixed(1)} ⭐
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: 12,
            padding: '24px',
            marginBottom: '24px',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginTop: 0, marginBottom: '16px' }}>
              Contact Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    style={{
                      background: '#1f2937',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14,
                      width: '100%',
                    }}
                  />
                ) : (
                  <div style={{ color: '#e5e7eb', fontSize: 14 }}>{shop.email}</div>
                )}
              </div>

              <div>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    style={{
                      background: '#1f2937',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14,
                      width: '100%',
                    }}
                  />
                ) : (
                  <div style={{ color: '#e5e7eb', fontSize: 14 }}>{shop.phone}</div>
                )}
              </div>

              <div>
                <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Location
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.location || ''}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    style={{
                      background: '#1f2937',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 14,
                      width: '100%',
                    }}
                  />
                ) : (
                  <div style={{ color: '#e5e7eb', fontSize: 14 }}>{shop.location}</div>
                )}
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div style={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: 12,
            padding: '24px',
            marginBottom: '24px',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginTop: 0, marginBottom: '16px' }}>
              Performance Metrics
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#1f2937', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px' }}>Total Jobs</div>
                <div style={{ color: '#3b82f6', fontSize: 24, fontWeight: 700 }}>{shop.totalJobs}</div>
              </div>

              <div style={{ background: '#1f2937', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px' }}>Completed</div>
                <div style={{ color: '#10b981', fontSize: 24, fontWeight: 700 }}>{shop.completedJobs}</div>
              </div>

              <div style={{ background: '#1f2937', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px' }}>Completion Rate</div>
                <div style={{ color: '#8b5cf6', fontSize: 24, fontWeight: 700 }}>
                  {(shop.completionRate * 100).toFixed(1)}%
                </div>
              </div>

              <div style={{ background: '#1f2937', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px' }}>Total Revenue</div>
                <div style={{ color: '#f59e0b', fontSize: 24, fontWeight: 700 }}>
                  ${(shop.totalRevenue / 1000).toFixed(1)}K
                </div>
              </div>

              <div style={{ background: '#1f2937', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px' }}>This Month</div>
                <div style={{ color: '#ec4899', fontSize: 24, fontWeight: 700 }}>
                  ${(shop.revenueThisMonth / 1000).toFixed(1)}K
                </div>
              </div>

              <div style={{ background: '#1f2937', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: '8px' }}>Tech Count</div>
                <div style={{ color: '#14b8a6', fontSize: 24, fontWeight: 700 }}>
                  {shop.activeTechs}/{shop.techCount}
                </div>
              </div>
            </div>
          </div>

          {/* Save Changes Button */}
          {isEditing && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 24px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <FaSave /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
