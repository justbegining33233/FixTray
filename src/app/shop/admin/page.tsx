'use client';

import { useEffect, useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import TopNavBar from '@/components/TopNavBar';
import Sidebar from '@/components/Sidebar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRequireAuth } from '@/contexts/AuthContext';
import {
  FaArrowRight,
  FaBox,
  FaBuilding,
  FaChartBar,
  FaClock,
  FaCog,
  FaDollarSign,
  FaUserCog,
  FaUsers,
} from 'react-icons/fa';
import OverviewTab from './tabs/OverviewTab';
import SettingsTab from './tabs/SettingsTab';
import PayrollTab from './tabs/PayrollTab';
import TeamTab from './tabs/TeamTab';
import InventoryTab from './tabs/InventoryTab';

export default function ShopAdminPage() {
  const { user, isLoading } = useRequireAuth(['shop']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const [_userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [shopId, setShopId] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [payrollData, setPayrollData] = useState<any>(null);
  const [shopStats, setShopStats] = useState<any>(null);
  const [budgetData, setBudgetData] = useState<any>({
    weeklyBudget: 0,
    monthlyBudget: 0,
    weeklySpent: 0,
    monthlySpent: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'payroll' | 'team' | 'inventory'>('overview');
  const [accessFeatures] = useState({
    payroll: true,
    multiRoleUsers: true,
    inventory: true,
  });
  
  // Date range for payroll
  const [payrollStartDate, setPayrollStartDate] = useState('');
  const [payrollEndDate, setPayrollEndDate] = useState('');
  
  // PDF generation
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Inventory management
  const [inventoryStock, setInventoryStock] = useState<any[]>([]);
  const [inventoryRequests, setInventoryRequests] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poForm, setPoForm] = useState({ vendor: '', itemName: '', quantity: 1, unitCost: 0, workOrderId: '' });
  const [showPoModal, setShowPoModal] = useState(false);
  const [_workOrderSearch, _setWorkOrderSearch] = useState('');
  const [workOrderOptions, setWorkOrderOptions] = useState<any[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Shop messages
  const [_shopMessages, setShopMessages] = useState<any[]>([]);
  const [_messageStats, setMessageStats] = useState<any>(null);
  const [adminMsg, setAdminMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  // Team management
  const [teamData, setTeamData] = useState<any[]>([]);

  const getLiveHours = (emp: any) => {
    if (typeof emp?.currentHours === 'number' && !Number.isNaN(emp.currentHours)) {
      return emp.currentHours;
    }

    if (emp?.clockedInAt) {
      const start = new Date(emp.clockedInAt).getTime();
      if (!Number.isNaN(start)) {
        const hours = (Date.now() - start) / 36e5;
        return Math.max(0, hours);
      }
    }

    return 0;
  };

  // Keep tab selection in sync with URL hashes so sidebar anchor clicks switch cards
  const setTab = (tab: 'overview' | 'settings' | 'payroll' | 'team' | 'inventory') => {
    // Managers cannot access the settings tab.
    if (tab === 'settings' && user?.role === 'manager') return;
    if (tab === 'payroll' && !accessFeatures?.payroll) return;
    if (tab === 'team' && !accessFeatures?.multiRoleUsers) return;
    if (tab === 'inventory' && !accessFeatures?.inventory) return;
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  useEffect(() => {
    const syncTabFromHash = () => {
      const hash = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as typeof activeTab;
      if (hash && ['overview', 'settings', 'payroll', 'team', 'inventory'].includes(hash)) {
        if (hash === 'settings' && user?.role === 'manager') {
          setActiveTab('overview');
          return;
        }
        if (hash === 'payroll' && !accessFeatures?.payroll) {
          setActiveTab('overview');
          return;
        }
        if (hash === 'team' && !accessFeatures?.multiRoleUsers) {
          setActiveTab('overview');
          return;
        }
        if (hash === 'inventory' && !accessFeatures?.inventory) {
          setActiveTab('overview');
          return;
        }
        setActiveTab(hash);
      }
    };

    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, [accessFeatures, user?.role]);

  useEffect(() => {
    if (isLoading) return;
    const isManager = user?.role === 'manager';
    if (user && !user.isShopAdmin && !isManager) {
      router.replace('/shop/home' as Route);
      return;
    }

    const admin = localStorage.getItem('isShopAdmin');
    const id = localStorage.getItem('shopId');
    const name = localStorage.getItem('userName');
    const profileComplete = localStorage.getItem('shopProfileComplete') === 'true';
    const agreementAccepted = localStorage.getItem('fixtrayAgreementAccepted') === 'true';

    // Only shop owners need isShopAdmin flag; managers bypass this check
    if (admin !== 'true' && !isManager) {
      router.push('/shop/home' as Route);
      return;
    }

    // Only shop owners need a complete profile; managers don't set up the shop
    if (!profileComplete && !isManager) {
      router.push('/shop/complete-profile' as Route);
      return;
    }

    if (!agreementAccepted && !isManager) {
      router.push('/shop/settings?tab=general' as Route);
      return;
    }

    setShopId(id || '');
    setUserName(name || '');
    setUserId(id || ''); // Shop owner's userId is same as shopId
    fetchSettings(id || '');
    fetchShopStats(id || '');
    fetchBudgetData(id || '');
    fetchInventoryStock(id || '');
    fetchInventoryRequests(id || '');
    fetchPurchaseOrders(id || '');
    fetchWorkOrderOptions(id || '', '');
    fetchShopMessages(id || '');
    fetchTeamData(id || '');
    
    // Set default date range (last 2 weeks)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    setPayrollEndDate(endDate.toISOString().split('T')[0]);
    setPayrollStartDate(startDate.toISOString().split('T')[0]);
    
    // Auto-fetch payroll data
    fetchPayrollData(id || '', startDate.toISOString(), endDate.toISOString());
    
    // Refresh live data every 5 seconds (stats, messages, team)
    const interval = setInterval(() => {
      fetchShopStats(id || '');
      fetchShopMessages(id || '');
      fetchTeamData(id || '');
    }, 5000);
    // Refresh budget and payroll every 30 seconds
    const budgetInterval = setInterval(() => {
      fetchBudgetData(id || '');
      const currentEnd = new Date();
      const currentStart = new Date(currentEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
      fetchPayrollData(id || '', currentStart.toISOString(), currentEnd.toISOString());
    }, 30000);
    return () => { clearInterval(interval); clearInterval(budgetInterval); };
  }, [router, user, isLoading]);

  const fetchShopStats = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/shop/stats?shopId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      
      if (response.ok) {
        const data = await response.json();
        setShopStats(data);
      } else {
        // Set empty data structure if fetch fails
        const errorText = await response.text();
        console.error('? Failed to fetch shop stats:', response.status, errorText);
        setShopStats({
          workOrders: { open: 0, completedToday: 0, completedThisWeek: 0, pendingApprovals: 0 },
          revenue: { today: 0, week: 0 },
          team: { total: 0, active: 0, clockedIn: 0, currentlyWorking: [] },
          inventory: { pendingRequests: 0 },
        });
      }
    } catch (error) {
      console.error('[ShopAdminPage]', <FaExclamationTriangle />, 'Error fetching shop stats:', error);
      // Set empty data structure on error
      setShopStats({
        workOrders: { open: 0, completedToday: 0, completedThisWeek: 0, pendingApprovals: 0 },
        revenue: { today: 0, week: 0 },
        team: { total: 0, active: 0, clockedIn: 0, currentlyWorking: [] },
        inventory: { pendingRequests: 0 },
      });
    }
  };

  const fetchBudgetData = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch settings for budget limits
      const settingsResponse = await fetch(`/api/shop/settings?shopId=${id}`);
      const { settings } = await settingsResponse.json();
      
      // Calculate date ranges
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Fetch weekly and monthly payroll in parallel
      const [weeklyResponse, monthlyResponse] = await Promise.all([
        fetch(`/api/shop/payroll?shopId=${id}&startDate=${startOfWeek.toISOString()}&endDate=${now.toISOString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/shop/payroll?shopId=${id}&startDate=${startOfMonth.toISOString()}&endDate=${now.toISOString()}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [weeklyData, monthlyData] = await Promise.all([weeklyResponse.json(), monthlyResponse.json()]);
      
      setBudgetData({
        weeklyBudget: settings?.weeklyPayrollBudget || 0,
        monthlyBudget: settings?.monthlyPayrollBudget || 0,
        weeklySpent: weeklyData.summary?.totalPay || 0,
        monthlySpent: monthlyData.summary?.totalPay || 0,
      });
    } catch (error) {
      console.error('Error fetching budget data:', error);
    }
  };

  const fetchInventoryStock = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const lowStockParam = showLowStockOnly ? '&lowStockOnly=true' : '';
      const response = await fetch(`/api/shop/inventory-stock?shopId=${id}${lowStockParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setInventoryStock(data.items || data.inventory || []);
      }
    } catch (error) {
      console.error('Error fetching inventory stock:', error);
    }
  };

  const fetchInventoryRequests = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/inventory-requests?shopId=${id}&status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setInventoryRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching inventory requests:', error);
    }
  };

  const fetchWorkOrderOptions = async (id: string, searchTerm: string) => {
    if (!id) return;
    setLoadingWorkOrders(true);
    try {
      const token = localStorage.getItem('token');
      const url = `/api/workorders?shopId=${id}&status=pending&limit=20${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setWorkOrderOptions(data.workOrders || []);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoadingWorkOrders(false);
    }
  };

  const fetchPurchaseOrders = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/purchase-orders?shopId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const fetchTeamData = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/team?shopId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTeamData(data.team || []);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    }
  };

  const fetchShopMessages = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/shop/messages?shopId=${id}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setShopMessages(data.messages || []);
        setMessageStats(data.stats || null);
      } else {
        setShopMessages([]);
        setMessageStats(null);
      }
    } catch (error) {
      console.error('Error fetching shop messages:', error);
      setShopMessages([]);
      setMessageStats(null);
    }
  };

  const fetchSettings = async (id: string) => {
    try {
      const response = await fetch(`/api/shop/settings?shopId=${id}`);
      if (response.ok) {
        const { settings } = await response.json();
        setSettings(settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/shop/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shopId, ...settings }),
      });

      if (response.ok) {
        setAdminMsg({type:'success',text:'Settings updated successfully!'});
      } else {
        setAdminMsg({type:'error',text:'Failed to update settings'});
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setAdminMsg({type:'error',text:'Error updating settings'});
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrollData = async (id: string, start?: string, end?: string) => {
    try {
      const token = localStorage.getItem('token');
      const startDate = start ? new Date(start) : new Date(payrollStartDate);
      const endDate = end ? new Date(end) : new Date(payrollEndDate);

      const response = await fetch(
        `/api/shop/payroll?shopId=${id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPayrollData(data);
      }
    } catch (error) {
      console.error('Error fetching payroll:', error);
    }
  };

  const handleRefreshPayroll = () => {
    setLoading(true);
    fetchPayrollData(shopId, payrollStartDate, payrollEndDate).finally(() => setLoading(false));
  };

  const downloadPayrollCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const startDate = new Date(payrollStartDate);
      const endDate = new Date(payrollEndDate);

      const response = await fetch(
        `/api/shop/payroll?shopId=${shopId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&format=csv`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll_${payrollStartDate}_to_${payrollEndDate}.csv`;
        a.click();
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
      setAdminMsg({type:'error',text:'Error downloading CSV'});
    }
  };

  const downloadPayrollPDF = async () => {
    if (!payrollData) return;
    
    setGeneratingPDF(true);
    try {
      // Dynamic import for client-side only
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Payroll Report', 14, 20);
      
      // Period
      doc.setFontSize(12);
      doc.text(`Period: ${payrollData.periodStart} to ${payrollData.periodEnd}`, 14, 30);
      doc.text(`Generated: ${new Date(payrollData.generatedAt).toLocaleString()}`, 14, 37);
      
      // Summary Box
      doc.setFillColor(59, 130, 246);
      doc.rect(14, 45, 60, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('Total Employees', 16, 52);
      doc.setFontSize(16);
      doc.text(payrollData.summary.totalEmployees.toString(), 16, 62);
      
      doc.setFillColor(34, 197, 94);
      doc.rect(80, 45, 60, 25, 'F');
      doc.setFontSize(10);
      doc.text('Total Hours', 82, 52);
      doc.setFontSize(16);
      doc.text(payrollData.summary.totalHours.toFixed(2), 82, 62);
      
      doc.setFillColor(239, 68, 68);
      doc.rect(146, 45, 60, 25, 'F');
      doc.setFontSize(10);
      doc.text('Total Payroll', 148, 52);
      doc.setFontSize(16);
      doc.text(`$${payrollData.summary.totalPayroll.toFixed(2)}`, 148, 62);
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Employee Details Table
      const tableData: any[] = [];
      payrollData.employees.forEach((emp: any) => {
        emp.entries.forEach((entry: any, idx: number) => {
          tableData.push([
            idx === 0 ? emp.name : '',
            idx === 0 ? emp.role : '',
            entry.date,
            entry.clockIn,
            entry.clockOut,
            entry.hours.toFixed(2),
            idx === 0 ? `$${emp.hourlyRate}` : '',
            `$${(entry.hours * emp.hourlyRate).toFixed(2)}`,
          ]);
        });
        // Subtotal row
        tableData.push([
          { content: `${emp.name} Total`, colSpan: 5, styles: { fontStyle: 'bold' } },
          { content: emp.totalHours.toFixed(2), styles: { fontStyle: 'bold' } },
          '',
          { content: `$${emp.totalPay.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [34, 197, 94] } },
        ]);
      });
      
      autoTable(doc, {
        startY: 75,
        head: [['Employee', 'Role', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Rate', 'Pay']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [31, 41, 55] },
      });
      
      // Save
      doc.save(`payroll_${payrollStartDate}_to_${payrollEndDate}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setAdminMsg({type:'error',text:'Error generating PDF'});
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleCreatePurchaseOrder = async () => {
    if (!shopId || !poForm.itemName) {
      setAdminMsg({type:'error',text:'Shop ID and item name are required'});
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        shopId,
        vendor: poForm.vendor || undefined,
        createdById: userId,
        customerApprovalStatus: 'pending',
        items: [
          {
            itemName: poForm.itemName,
            quantity: Number(poForm.quantity) || 0,
            unitCost: Number(poForm.unitCost) || 0,
            workOrderId: poForm.workOrderId || undefined,
          },
        ],
      };

      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setPoForm({ vendor: '', itemName: '', quantity: 1, unitCost: 0, workOrderId: '' });
        setShowPoModal(false);
        fetchPurchaseOrders(shopId);
        setAdminMsg({type:'success',text:'Purchase order created. Awaiting customer approval.'});
      } else {
        const data = await response.json().catch(() => ({}));
        setAdminMsg({type:'error',text:data.error || 'Failed to create purchase order'});
      }
    } catch (error) {
      console.error('Error creating purchase order:', error);
      setAdminMsg({type:'error',text:'Failed to create purchase order'});
    }
  };

  const handleReceivePurchaseOrder = async (poId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiveItems: true, status: 'received' }),
      });

      if (response.ok) {
        fetchPurchaseOrders(shopId);
        fetchInventoryStock(shopId);
      } else {
        const data = await response.json().catch(() => ({}));
        setAdminMsg({type:'error',text:data.error || 'Failed to receive purchase order'});
      }
    } catch (error) {
      console.error('Error receiving purchase order:', error);
      setAdminMsg({type:'error',text:'Failed to receive purchase order'});
    }
  };

  const openWorkOrders = shopStats?.workOrders?.open ?? 0;
  const completedThisWeek = shopStats?.workOrders?.completedThisWeek ?? 0;
  const weeklyRevenue = shopStats?.revenue?.week ?? 0;
  const teamCount = shopStats?.team?.total ?? 0;
  const clockedInCount = shopStats?.team?.clockedIn ?? 0;
  const inventoryCount = inventoryStock?.length ?? 0;
  const pendingActions = (shopStats?.workOrders?.pendingApprovals ?? 0) + (shopStats?.inventory?.pendingRequests ?? 0);
  const totalPipeline = openWorkOrders + completedThisWeek;
  const completionRate = totalPipeline > 0 ? Math.round((completedThisWeek / totalPipeline) * 100) : 0;
  const weeklyBudget = budgetData?.weeklyBudget ?? 0;
  const weeklySpent = budgetData?.weeklySpent ?? 0;
  const payrollUtilization = weeklyBudget > 0 ? Math.min(100, Math.round((weeklySpent / weeklyBudget) * 100)) : 0;

  const statCards = [
    { label: 'Open Work Orders', value: String(openWorkOrders), sub: `${completedThisWeek} completed this week`, color: '#e5332a', icon: <FaClock /> },
    { label: 'Weekly Revenue', value: `$${Number(weeklyRevenue).toFixed(2)}`, sub: `${completionRate}% weekly completion rate`, color: '#22c55e', icon: <FaDollarSign /> },
    { label: 'Team Coverage', value: `${clockedInCount}/${teamCount}`, sub: 'Clocked in right now', color: '#f59e0b', icon: <FaUsers /> },
    { label: 'Inventory Health', value: String(inventoryCount), sub: `${pendingActions} pending admin actions`, color: '#a855f7', icon: <FaBox /> },
  ];

  const quickLinks = [
    { href: '/shop/analytics', label: 'Shop Analytics', desc: 'Performance trends, SLA, profit', color: '#8b5cf6', icon: <FaChartBar /> },
    { href: '/shop/analytics', label: 'Reports Center', desc: 'Payroll, exports, and summaries', color: '#22c55e', icon: <FaBuilding /> },
    { href: '/shop/manage-team', label: 'Team Operations', desc: 'Roles, staffing, and access', color: '#e5332a', icon: <FaUserCog /> },
    { href: '/shop/inventory', label: 'Inventory Control', desc: 'Stock, POs, and reorders', color: '#f59e0b', icon: <FaBox /> },
    { href: '/shop/settings', label: 'Shop Settings', desc: 'Rates, alerts, and configuration', color: '#e5332a', icon: <FaCog /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <TopNavBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenuButton={true} />
      {/* Breadcrumbs */}
      <Breadcrumbs />
      {/* Main Layout with Sidebar */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <Sidebar
          role="shop"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelectTab={(tab) => setTab(tab as typeof activeTab)}
          activeHash={`#${activeTab}`}
        />
        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(229,51,42,0.16)', border: '1px solid rgba(229,51,42,0.3)', color: '#e5332a', fontSize: 18 }}>
                  <FaBuilding />
                </div>
                <div>
                  <h1 style={{ margin: 0, color: '#e5e7eb', fontSize: 28, fontWeight: 800 }}>Shop Admin Command Center</h1>
                  <div style={{ color: '#9aa3b2', fontSize: 13 }}>In-depth operational and financial analytics for your shop</div>
                </div>
              </div>
            </div>

            {/* Primary KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
              {statCards.map((card) => (
                <div key={card.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ color: '#9aa3b2', fontSize: 12, fontWeight: 700 }}>{card.label}</div>
                    <div style={{ color: card.color, fontSize: 16 }}>{card.icon}</div>
                  </div>
                  <div style={{ color: '#e5e7eb', fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>{card.value}</div>
                  <div style={{ marginTop: 5, color: '#9aa3b2', fontSize: 12 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Secondary Analytics Row */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: 16 }}>
                <div style={{ color: '#e5e7eb', fontWeight: 700, marginBottom: 10 }}>Weekly Operations Health</div>
                <div style={{ marginBottom: 8, color: '#9aa3b2', fontSize: 12 }}>Completion Rate</div>
                <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ width: `${completionRate}%`, height: '100%', background: 'linear-gradient(90deg, #e5332a, #22c55e)' }} />
                </div>
                <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 700 }}>{completionRate}% ({completedThisWeek}/{totalPipeline || 0})</div>

                {weeklyBudget > 0 && (
                  <>
                    <div style={{ marginTop: 14, marginBottom: 8, color: '#9aa3b2', fontSize: 12 }}>Payroll Budget Utilization</div>
                    <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{ width: `${payrollUtilization}%`, height: '100%', background: payrollUtilization >= 95 ? 'linear-gradient(90deg, #f59e0b, #e5332a)' : 'linear-gradient(90deg, #22c55e, #e5332a)' }} />
                    </div>
                    <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 700 }}>{payrollUtilization}% (${weeklySpent.toFixed(2)} / ${weeklyBudget.toFixed(2)})</div>
                  </>
                )}
              </div>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 8, marginBottom: 20 }}>
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'inventory', label: 'Inventory' },
                { id: 'team', label: 'Team' },
                { id: 'payroll', label: 'Payroll' },
                { id: 'settings', label: 'Settings' },
              ].map((tab) => {
                const disabled =
                  (tab.id === 'settings' && user?.role === 'manager') ||
                  (tab.id === 'payroll' && !accessFeatures?.payroll) ||
                  (tab.id === 'team' && !accessFeatures?.multiRoleUsers) ||
                  (tab.id === 'inventory' && !accessFeatures?.inventory);
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTab(tab.id as typeof activeTab)}
                    disabled={disabled}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 9,
                      border: 'none',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      background: selected ? '#e5332a' : 'rgba(255,255,255,0.04)',
                      color: selected ? '#fff' : disabled ? '#6b7280' : '#cbd5e1',
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <OverviewTab
                shopStats={shopStats}
                inventoryStock={inventoryStock}
                budgetData={budgetData}
                userId={userId}
                shopId={shopId}
                getLiveHours={getLiveHours}
                setTab={setTab}
              />
            )}

            {activeTab === 'settings' && settings && user?.role !== 'manager' && (
              <SettingsTab
                settings={settings}
                setSettings={setSettings}
                loading={loading}
                handleUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeTab === 'payroll' && accessFeatures?.payroll && (
              <PayrollTab
                payrollData={payrollData}
                loading={loading}
                payrollStartDate={payrollStartDate}
                payrollEndDate={payrollEndDate}
                setPayrollStartDate={setPayrollStartDate}
                setPayrollEndDate={setPayrollEndDate}
                generatingPDF={generatingPDF}
                handleRefreshPayroll={handleRefreshPayroll}
                downloadPayrollCSV={downloadPayrollCSV}
                downloadPayrollPDF={downloadPayrollPDF}
              />
            )}

            {activeTab === 'team' && accessFeatures?.multiRoleUsers && (
              <TeamTab teamData={teamData} />
            )}

            {activeTab === 'inventory' && accessFeatures?.inventory && (
              <InventoryTab
                showLowStockOnly={showLowStockOnly}
                setShowLowStockOnly={setShowLowStockOnly}
                inventoryStock={inventoryStock}
                inventoryRequests={inventoryRequests}
                purchaseOrders={purchaseOrders}
                poForm={poForm}
                setPoForm={setPoForm}
                showPoModal={showPoModal}
                setShowPoModal={setShowPoModal}
                workOrderOptions={workOrderOptions}
                loadingWorkOrders={loadingWorkOrders}
                shopId={shopId}
                fetchInventoryStock={fetchInventoryStock}
                fetchInventoryRequests={fetchInventoryRequests}
                handleCreatePurchaseOrder={handleCreatePurchaseOrder}
                handleReceivePurchaseOrder={handleReceivePurchaseOrder}
              />
            )}
          </div>
        </div>
      </div>

      {adminMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:adminMsg.type==='success'?'#dcfce7':'#fde8e8',color:adminMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {adminMsg.text}
          <button onClick={()=>setAdminMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}
    </div>
  );
}


