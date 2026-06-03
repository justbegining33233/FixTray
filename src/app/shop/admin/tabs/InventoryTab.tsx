'use client';

import { useState } from 'react';
import { FaCheckCircle, FaClipboardList, FaExclamationTriangle, FaFilter, FaPlus, FaTimes, FaWarehouse } from 'react-icons/fa';

interface InventoryTabProps {
  showLowStockOnly: boolean;
  setShowLowStockOnly: (v: boolean) => void;
  inventoryStock: any[];
  inventoryRequests: any[];
  purchaseOrders: any[];
  poForm: any;
  setPoForm: (f: any) => void;
  showPoModal: boolean;
  setShowPoModal: (v: boolean) => void;
  workOrderOptions: any[];
  loadingWorkOrders: boolean;
  shopId: string;
  fetchInventoryStock: (id: string) => void;
  fetchInventoryRequests: (id: string) => void;
  handleCreatePurchaseOrder: () => void;
  handleReceivePurchaseOrder: (id: string) => void;
}

export default function InventoryTab({
  showLowStockOnly,
  setShowLowStockOnly,
  inventoryStock,
  inventoryRequests,
  purchaseOrders,
  poForm,
  setPoForm,
  showPoModal,
  setShowPoModal,
  workOrderOptions,
  loadingWorkOrders,
  shopId,
  fetchInventoryStock,
  fetchInventoryRequests,
  handleCreatePurchaseOrder,
  handleReceivePurchaseOrder,
}: InventoryTabProps) {
  const [inventorySearch, setInventorySearch] = useState('');
  const lowStockCount = inventoryStock.filter((i: any) => i.quantity <= i.reorderPoint).length;
  const totalUnits = inventoryStock.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
  const normalizedSearch = inventorySearch.trim().toLowerCase();
  const filteredInventory = normalizedSearch
    ? inventoryStock.filter((item: any) => {
        const text = [item.itemName, item.sku, item.category, item.location]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(normalizedSearch);
      })
    : inventoryStock;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: '#e5e7eb', fontSize: 24, margin: 0 }}>Inventory Management</h2>
          <div style={{ color: '#9aa3b2', fontSize: 13, marginTop: 4 }}>Track stock, handle approvals, and process purchase orders.</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e5e7eb', cursor: 'pointer', fontSize: 13 }}>
          <FaFilter style={{ color: '#9aa3b2' }} />
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => {
              setShowLowStockOnly(e.target.checked);
              fetchInventoryStock(shopId);
            }}
          />
          Show Low Stock Only
        </label>
      </div>

      <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <div style={{ background: 'rgba(229,51,42,0.1)', border: '1px solid rgba(229,51,42,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Inventory Items</div>
          <div style={{ color: '#ff6b64', fontSize: 22, fontWeight: 800 }}>{inventoryStock.length}</div>
        </div>
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Units On Hand</div>
          <div style={{ color: '#22c55e', fontSize: 22, fontWeight: 800 }}>{totalUnits}</div>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Low Stock</div>
          <div style={{ color: '#f59e0b', fontSize: 22, fontWeight: 800 }}>{lowStockCount}</div>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#9aa3b2', fontSize: 11 }}>Pending Requests</div>
          <div style={{ color: '#ef4444', fontSize: 22, fontWeight: 800 }}>{inventoryRequests.length}</div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ color: '#e5e7eb', fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaClipboardList /> Purchase Orders
          </h3>
          <button
            onClick={() => setShowPoModal(true)}
            style={{ padding: '8px 14px', background: '#e5332a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FaPlus /> New PO
          </button>
        </div>

        {showPoModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowPoModal(false)}
          >
            <div
              style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 560, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: '#e5e7eb', fontSize: 20, margin: 0, fontWeight: 700 }}>Create Purchase Order</h3>
                <button onClick={() => setShowPoModal(false)} style={{ background: 'none', border: 'none', color: '#9aa3b2', fontSize: 18, cursor: 'pointer' }}>
                  <FaTimes />
                </button>
              </div>

              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#fbbf24' }}>
                Customer approval is required before ordering. New POs are marked as Awaiting Approval.
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', marginBottom: 14 }}>
                <input type="text" value={poForm.vendor} onChange={(e) => setPoForm({ ...poForm, vendor: e.target.value })} placeholder="Vendor (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb' }} />
                <input type="text" value={poForm.itemName} onChange={(e) => setPoForm({ ...poForm, itemName: e.target.value })} placeholder="Item name" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb' }} />
                <input type="number" min={1} value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })} placeholder="Quantity" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb' }} />
                <input type="number" min={0} step="0.01" value={poForm.unitCost} onChange={(e) => setPoForm({ ...poForm, unitCost: Number(e.target.value) })} placeholder="Unit cost" style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#e5e7eb' }} />
              </div>

              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(0,0,0,0.3)', marginBottom: 14 }}>
                {loadingWorkOrders ? (
                  <div style={{ color: '#9aa3b2', fontSize: 12, padding: 10 }}>Loading work orders...</div>
                ) : workOrderOptions.length === 0 ? (
                  <div style={{ color: '#9aa3b2', fontSize: 12, padding: 10 }}>No open work orders</div>
                ) : (
                  workOrderOptions.map((wo: any) => (
                    <div
                      key={wo.id}
                      onClick={() => setPoForm({ ...poForm, workOrderId: wo.id })}
                      style={{
                        padding: '8px 10px',
                        cursor: 'pointer',
                        color: poForm.workOrderId === wo.id ? '#22c55e' : '#e5e7eb',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        fontSize: 12,
                        background: poForm.workOrderId === wo.id ? 'rgba(34,197,94,0.1)' : 'transparent',
                      }}
                    >
                      {wo.id.slice(-6)} | {wo.status} | {wo.issueDescription?.symptoms || ''}
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowPoModal(false)} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: '#e5e7eb', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleCreatePurchaseOrder} style={{ padding: '10px 16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                  Create PO
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg,#38bdf8,#6366f1)', color: 'white', padding: '10px 14px', fontWeight: 700 }}>Existing Purchase Orders</div>
          <div style={{ padding: 10, display: 'grid', gap: 10 }}>
            {purchaseOrders.length === 0 ? (
              <div style={{ color: '#9aa3b2', fontSize: 13 }}>No purchase orders yet.</div>
            ) : (
              purchaseOrders.map((po: any) => (
                <div key={po.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, background: 'rgba(0,0,0,0.25)', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ color: '#e5e7eb', fontWeight: 700 }}>PO-{po.id.slice(-6)} {po.vendor ? `| ${po.vendor}` : ''}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.12)', color: '#e5e7eb' }}>{po.status.toUpperCase()}</span>
                      {po.status !== 'received' && (
                        <button onClick={() => handleReceivePurchaseOrder(po.id)} style={{ padding: '6px 10px', background: '#0ea5e9', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                          Mark Received
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ color: '#9aa3b2', fontSize: 12, marginTop: 6 }}>Items: {po.items?.length || 0} | Created: {new Date(po.createdAt).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {inventoryRequests.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <h3 style={{ color: '#ef4444', fontSize: 18, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaExclamationTriangle /> Pending Inventory Requests ({inventoryRequests.length})
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {inventoryRequests.map((request: any) => (
              <div key={request.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 14 }}>{request.itemName} (x{request.quantity})</div>
                  <div style={{ color: '#9aa3b2', fontSize: 12 }}>Requested by: {request.requesterName}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem('token');
                      await fetch('/api/shop/inventory-requests', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ requestId: request.id, status: 'approved', approvedBy: localStorage.getItem('userId') }),
                      });
                      fetchInventoryRequests(shopId);
                      fetchInventoryStock(shopId);
                    }}
                    style={{ padding: '8px 12px', background: '#22c55e', border: 'none', borderRadius: 6, color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <FaCheckCircle /> Approve
                  </button>
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem('token');
                      await fetch('/api/shop/inventory-requests', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ requestId: request.id, status: 'denied', approvedBy: localStorage.getItem('userId') }),
                      });
                      fetchInventoryRequests(shopId);
                    }}
                    style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ color: '#e5e7eb', fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaWarehouse /> Inventory
            </h3>
            <input
              type="text"
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              placeholder="Search inventory by item, SKU, category, or location"
              style={{
                width: '100%',
                maxWidth: 420,
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.35)',
                color: '#e5e7eb',
                fontSize: 13,
              }}
            />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: 14, textAlign: 'left', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>Item Name</th>
                <th style={{ padding: 14, textAlign: 'left', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>SKU</th>
                <th style={{ padding: 14, textAlign: 'left', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>Category</th>
                <th style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>Quantity</th>
                <th style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>Reorder</th>
                <th style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>Unit Cost</th>
                <th style={{ padding: 14, textAlign: 'left', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>Location</th>
                <th style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9aa3b2' }}>
                    <div style={{ fontSize: 42, marginBottom: 10 }}><FaWarehouse /></div>
                    <div>{inventoryStock.length === 0 ? 'No inventory items found' : 'No matching inventory items found'}</div>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item: any) => {
                  const isLowStock = item.quantity <= item.reorderPoint;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isLowStock ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                      <td style={{ padding: 14, color: '#e5e7eb', fontWeight: 600 }}>{item.itemName}</td>
                      <td style={{ padding: 14, color: '#9aa3b2', fontSize: 12 }}>{item.sku || '-'}</td>
                      <td style={{ padding: 14, color: '#9aa3b2', fontSize: 12 }}>{item.category || '-'}</td>
                      <td style={{ padding: 14, textAlign: 'center', color: isLowStock ? '#ef4444' : '#e5e7eb', fontWeight: 700 }}>{item.quantity}</td>
                      <td style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontSize: 12 }}>{item.reorderPoint}</td>
                      <td style={{ padding: 14, textAlign: 'center', color: '#9aa3b2', fontSize: 12 }}>${item.unitCost?.toFixed(2) || '0.00'}</td>
                      <td style={{ padding: 14, color: '#9aa3b2', fontSize: 12 }}>{item.location || '-'}</td>
                      <td style={{ padding: 14, textAlign: 'center' }}>
                        {isLowStock ? (
                          <span style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#ef4444', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>LOW STOCK</span>
                        ) : (
                          <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, color: '#22c55e', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>IN STOCK</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
