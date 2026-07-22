'use client';

import { useEffect, useState } from 'react';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaBox, FaCheckCircle, FaTruck, FaArrowRight, FaTimesCircle } from 'react-icons/fa';

interface PurchaseOrder {
  id: string;
  vendor: string;
  status: 'ordered' | 'shipped' | 'received' | 'cancelled';
  totalCost: number;
  expectedDate?: string;
  items: Array<{
    id: string;
    itemName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    status: string;
  }>;
  createdAt: string;
}

const statusColors = {
  ordered: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', icon: <FaBox />, text: 'Ordered' },
  shipped: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', icon: <FaTruck />, text: 'Shipped' },
  received: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', icon: <FaCheckCircle />, text: 'Received' },
  cancelled: { bg: 'rgba(229,51,42,0.15)', color: '#e5332a', icon: <FaTimesCircle />, text: 'Cancelled' },
};

export default function PurchaseOrdersRecievingPage() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager']);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [receiving, setReceiving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadOrders();
  }, [user]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const shopId = user?.shopId || user?.id;
      const res = await fetch(`/api/shop/purchase-orders?shopId=${shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveOrder = async (orderId: string) => {
    setReceiving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'received' }),
      });
      if (res.ok) {
        setSelectedOrder(null);
        loadOrders();
      }
    } catch (error) {
      console.error('Failed to receive order:', error);
    } finally {
      setReceiving(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shop/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        loadOrders();
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    }
  };

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const orderedOrders = orders.filter(o => o.status === 'ordered');
  const shippedOrders = orders.filter(o => o.status === 'shipped');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000000' }}>
      <Sidebar role={user?.role || 'shop'} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton />
        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', marginBottom: 32 }}>
            <FaTruck style={{ marginRight: 12, verticalAlign: 'middle' }} />
            Receiving Workflow
          </h1>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading orders...</div>
          ) : (
            <>
              {/* Awaiting Shipment */}
              {orderedOrders.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>
                    Awaiting Shipment ({orderedOrders.length})
                  </h2>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {orderedOrders.map(order => {
                      const style = statusColors[order.status];
                      return (
                        <div
                          key={order.id}
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            padding: 16,
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                              <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 8 }}>
                                {order.vendor} - {order.items.length} items
                              </div>
                              <div style={{ color: '#9ca3af', fontSize: 13 }}>
                                Ordered: {new Date(order.createdAt).toLocaleDateString()}
                                {order.expectedDate && ` | Expected: ${new Date(order.expectedDate).toLocaleDateString()}`}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                background: style.bg,
                                color: style.color,
                                padding: '6px 12px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}>
                                {style.icon}
                                {style.text}
                              </div>
                              <div style={{ color: '#ec4899', fontWeight: 600, fontSize: 14 }}>
                                ${order.totalCost.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* In Transit */}
              {shippedOrders.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>
                    In Transit ({shippedOrders.length})
                  </h2>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {shippedOrders.map(order => {
                      const style = statusColors[order.status];
                      return (
                        <div
                          key={order.id}
                          style={{
                            background: 'rgba(59,130,246,0.05)',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: 12,
                            padding: 16,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                            <div>
                              <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 8 }}>
                                {order.vendor} - {order.items.length} items
                              </div>
                              <div style={{ color: '#9ca3af', fontSize: 13 }}>
                                Expected: {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'N/A'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                background: style.bg,
                                color: style.color,
                                padding: '6px 12px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}>
                                {style.icon}
                                {style.text}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'received')}
                            style={{
                              background: '#22c55e',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '8px 16px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 13,
                              width: '100%',
                            }}
                          >
                            <FaCheckCircle style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            Mark as Received
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {orders.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12, color: '#9ca3af' }}>
                  No purchase orders
                </div>
              )}
            </>
          )}

          {/* Order Detail Modal */}
          {selectedOrder && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            }}>
              <div style={{
                background: '#0f172a',
                borderRadius: 12,
                maxWidth: 600,
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                padding: 24,
              }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 16 }}>
                  PO: {selectedOrder.vendor}
                </h2>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Items</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedOrder.items.map(item => (
                      <div key={item.id} style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 6,
                        padding: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}>
                        <div>
                          <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>{item.itemName}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>SKU: {item.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#e5e7eb', fontWeight: 600 }}>Qty: {item.quantity}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>${item.unitCost.toFixed(2)}/ea</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.1)',
                      color: '#e5e7eb',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Close
                  </button>
                  {selectedOrder.status === 'shipped' && (
                    <button
                      onClick={() => handleReceiveOrder(selectedOrder.id)}
                      disabled={receiving}
                      style={{
                        flex: 1,
                        background: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: '10px 16px',
                        cursor: receiving ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: 13,
                        opacity: receiving ? 0.6 : 1,
                      }}
                    >
                      {receiving ? 'Processing...' : 'Confirm Receipt'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
