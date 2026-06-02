'use client';

import { useState } from 'react';

import Link from 'next/link';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaArrowLeft, FaArrowRight, FaBook, FaStopwatch, FaTools } from 'react-icons/fa';

export default function AllTechTools() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [selectedCategory, setSelectedCategory] = useState('All');

  if (isLoading) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#e5e7eb', fontSize: 18}}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // useRequireAuth handles redirect
  }

  const tools = [
    {
      title: 'New Roadside Job',
      description: 'Create emergency roadside assistance work orders for towing, jumpstart, tire changes, and more',
      icon: '',
      link: '/tech/new-roadside-job',
      category: 'Job Creation'
    },
    {
      title: 'New In-Shop Job',
      description: 'Schedule in-shop service appointments with vehicle diagnostics and service selection',
      icon: '',
      link: '/tech/new-inshop-job',
      category: 'Job Creation'
    },
    {
      title: 'Share Location',
      description: 'Share your real-time GPS location with dispatch and customers for roadside calls',
      icon: '',
      link: '/tech/share-location',
      category: 'Field Tools'
    },
    {
      title: 'Messages',
      description: 'View and respond to messages from dispatch, customers, and shop team',
      icon: '',
      link: '/tech/messages',
      category: 'Communication'
    },
    {
      title: 'Active Jobs',
      description: 'View all your currently assigned work orders and update their status',
      icon: '',
      link: '/tech/home',
      category: 'Job Management'
    },
    {
      title: 'Job History',
      description: 'Browse completed work orders, customer feedback, and service history',
      icon: '',
      link: '/tech/home',
      category: 'Job Management'
    },
    {
      title: 'Parts Inventory',
      description: 'Check parts availability, request orders, and track inventory levels',
      icon: '',
      link: '/tech/inventory',
      category: 'Resources'
    },
    {
      title: 'Service Manuals',
      description: 'Access technical documentation, repair guides, and service procedures',
      icon: <FaBook style={{marginRight:4}} />,
      link: '/tech/manuals',
      category: 'Resources'
    },
    {
      title: 'Time Tracking',
      description: 'Clock in/out, track billable hours, and submit timesheets',
      icon: <FaStopwatch style={{marginRight:4}} />,
      link: '/tech/timesheet',
      category: 'Time Management'
    },
    {
      title: 'Customer Portal',
      description: 'Access customer vehicle history, previous services, and maintenance records',
      icon: '',
      link: '/tech/customers',
      category: 'Customer Service'
    },
    {
      title: 'Diagnostic Tools',
      description: 'Run vehicle diagnostics, read error codes, and generate inspection reports',
      icon: '',
      link: '/tech/diagnostics',
      category: 'Technical Tools'
    },
    {
      title: 'Photo Upload',
      description: 'Upload before/after photos, damage documentation, and service evidence',
      icon: '',
      link: '/tech/photos',
      category: 'Documentation'
    },
  ];

  const categories = ['All', 'Job Creation', 'Job Management', 'Field Tools', 'Communication', 'Resources', 'Time Management', 'Customer Service', 'Technical Tools', 'Documentation'];

  const filteredTools = selectedCategory === 'All' ? tools : tools.filter(t => t.category === selectedCategory);

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1400, margin:'0 auto'}}>
          <Link href="/tech/home" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:16, display:'inline-block'}}>
            <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
          </Link>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaTools style={{marginRight:4}} /> All Tech Tools</h1>
              <p style={{fontSize:14, color:'#9aa3b2'}}>Complete suite of technician productivity tools and resources</p>
            </div>
            <div style={{padding:'12px 20px', background:'rgba(229,51,42,0.2)', borderRadius:8, border:'1px solid rgba(229,51,42,0.3)'}}>
              <div style={{fontSize:24, fontWeight:700, color:'#e5332a'}}>{filteredTools.length}</div>
              <div style={{fontSize:11, color:'#9aa3b2', marginTop:2}}>Available Tools</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1400, margin:'0 auto', padding:32}}>
        {/* Category Filter */}
        <div style={{marginBottom:32}}>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{padding:'8px 16px', background:selectedCategory === cat ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.05)', color:selectedCategory === cat ? '#e5332a' : '#9aa3b2', border:`1px solid ${selectedCategory === cat ? 'rgba(229,51,42,0.3)' : 'rgba(255,255,255,0.2)'}`, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer'}}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tools Grid */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20}}>
          {filteredTools.map(tool => (
            <Link 
              key={tool.title} 
              href={tool.link as Route}
              style={{textDecoration:'none', display:'block', height:'100%'}}
            >
              <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, cursor:'pointer', transition:'all 0.3s', height:'100%', display:'flex', flexDirection:'column'}}>
                <div style={{fontSize:40, marginBottom:16}}>{tool.icon}</div>
                <div style={{marginBottom:8}}>
                  <span style={{padding:'4px 10px', background:'rgba(229,51,42,0.2)', color:'#e5332a', borderRadius:6, fontSize:11, fontWeight:600}}>
                    {tool.category}
                  </span>
                </div>
                <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', marginBottom:8}}>{tool.title}</h3>
                <p style={{fontSize:14, color:'#9aa3b2', lineHeight:1.6, flex:1}}>{tool.description}</p>
                <div style={{marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.1)'}}>
                  <span style={{color:'#e5332a', fontSize:14, fontWeight:600}}>Open Tool <FaArrowRight style={{marginRight:4}} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Platform Stats */}
        <div style={{marginTop:48, padding:32, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12}}>
          <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:24}}>Your Performance Overview</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:20}}>
            <div style={{padding:20, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8}}>
              <div style={{fontSize:28, fontWeight:700, color:'#22c55e', marginBottom:4}}>47</div>
              <div style={{fontSize:13, color:'#9aa3b2'}}>Jobs Completed This Month</div>
            </div>
            <div style={{padding:20, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8}}>
              <div style={{fontSize:28, fontWeight:700, color:'#f59e0b', marginBottom:4}}>4.8</div>
              <div style={{fontSize:13, color:'#9aa3b2'}}>Average Customer Rating</div>
            </div>
            <div style={{padding:20, background:'rgba(229,51,42,0.1)', border:'1px solid rgba(229,51,42,0.3)', borderRadius:8}}>
              <div style={{fontSize:28, fontWeight:700, color:'#e5332a', marginBottom:4}}>156</div>
              <div style={{fontSize:13, color:'#9aa3b2'}}>Total Billable Hours</div>
            </div>
            <div style={{padding:20, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:8}}>
              <div style={{fontSize:28, fontWeight:700, color:'#8b5cf6', marginBottom:4}}>92%</div>
              <div style={{fontSize:13, color:'#9aa3b2'}}>On-Time Completion Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

