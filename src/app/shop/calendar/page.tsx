'use client';
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date
  time: string;
  type: 'appointment' | 'workorder';
  status: string;
  customer?: string;
  service?: string;
}

export default function ShopCalendar() {
  const { user, isLoading } = useRequireAuth(['shop', 'manager', 'tech']);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch both appointments and work orders in parallel
      const [appointmentsRes, workOrdersRes] = await Promise.all([
        fetch('/api/appointments', { headers }),
        fetch('/api/workorders?limit=200', { headers }),
      ]);

      const mapped: CalendarEvent[] = [];

      if (appointmentsRes.ok) {
        const apptData = await appointmentsRes.json();
        const appointments = apptData.appointments || apptData || [];
        for (const a of appointments) {
          const d = new Date(a.scheduledDate);
          mapped.push({
            id: a.id,
            title: a.serviceType || 'Appointment',
            date: d.toISOString().split('T')[0],
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'appointment',
            status: a.status,
            customer: a.customer ? `${a.customer.firstName || ''} ${a.customer.lastName || ''}`.trim() : undefined,
            service: a.serviceType,
          });
        }
      }

      if (workOrdersRes.ok) {
        const woData = await workOrdersRes.json();
        const workOrders = woData.workOrders || [];
        for (const wo of workOrders) {
          if (wo.dueDate) {
            const d = new Date(wo.dueDate);
            mapped.push({
              id: wo.id,
              title: wo.issueDescription?.substring(0, 50) || 'Work Order',
              date: d.toISOString().split('T')[0],
              time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'workorder',
              status: wo.status,
              customer: wo.customer ? `${wo.customer.firstName || ''} ${wo.customer.lastName || ''}`.trim() : undefined,
              service: wo.vehicleType,
            });
          }
          // Also show by creation date for orders without dueDate
          const created = new Date(wo.createdAt);
          if (!wo.dueDate) {
            mapped.push({
              id: wo.id,
              title: wo.issueDescription?.substring(0, 50) || 'Work Order',
              date: created.toISOString().split('T')[0],
              time: created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'workorder',
              status: wo.status,
              customer: wo.customer ? `${wo.customer.firstName || ''} ${wo.customer.lastName || ''}`.trim() : undefined,
              service: wo.vehicleType,
            });
          }
        }
      }

      setEvents(mapped);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) fetchEvents();
  }, [isLoading, user, fetchEvents]);

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e5e7eb' }}>Loading...</div>;
  if (!user) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const eventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Week view: get start of week (Sunday)
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };

  const statusColor = (status: string) => {
    switch (status) {
      case 'scheduled': case 'pending': return '#f59e0b';
      case 'confirmed': case 'assigned': case 'in-progress': return '#e5332a';
      case 'completed': case 'closed': return '#22c55e';
      case 'cancelled': case 'no-show': case 'denied-estimate': return '#ef4444';
      default: return '#9aa3b2';
    }
  };

  const typeColor = (type: string) => type === 'appointment' ? 'rgba(229,51,42,0.15)' : 'rgba(168,85,247,0.15)';

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  return (
    <div style={{minHeight:'100vh', background:'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/shop/home" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Shop Calendar</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Appointments & Work Orders</div>
          </div>
        </div>
        <Link href="/shop/home" style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', borderRadius:6, textDecoration:'none', fontSize:13, fontWeight:600}}>
          <FaArrowLeft style={{marginRight:4}} /> Back to Dashboard
        </Link>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32}}>
        {/* Controls */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12}}>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button onClick={view === 'month' ? prevMonth : prevWeek} style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'none', borderRadius:8, cursor:'pointer', fontSize:16, fontWeight:700}}><FaChevronLeft style={{marginRight:4}} /></button>
            <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', margin:0, minWidth:250, textAlign:'center'}}>
              {view === 'month' ? monthName : `Week of ${startOfWeek.toLocaleDateString()}`}
            </h2>
            <button onClick={view === 'month' ? nextMonth : nextWeek} style={{padding:'8px 16px', background:'rgba(255,255,255,0.1)', color:'#e5e7eb', border:'none', borderRadius:8, cursor:'pointer', fontSize:16, fontWeight:700}}><FaChevronRight style={{marginRight:4}} /></button>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={goToday} style={{padding:'8px 16px', background:'#e5332a', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600}}>Today</button>
            <button onClick={() => setView('month')} style={{padding:'8px 16px', background: view === 'month' ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.1)', color: view === 'month' ? '#e5332a' : '#9aa3b2', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600}}>Month</button>
            <button onClick={() => setView('week')} style={{padding:'8px 16px', background: view === 'week' ? 'rgba(229,51,42,0.2)' : 'rgba(255,255,255,0.1)', color: view === 'week' ? '#e5332a' : '#9aa3b2', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600}}>Week</button>
          </div>
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:60, color:'#9aa3b2', fontSize:18}}>Loading calendar...</div>
        ) : view === 'month' ? (
          /* Month View */
          <div style={{background:'rgba(0,0,0,0.2)', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden'}}>
            {/* Day Headers */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{padding:'12px 8px', textAlign:'center', fontSize:13, fontWeight:700, color:'#9aa3b2', textTransform:'uppercase'}}>{d}</div>
              ))}
            </div>
            {/* Calendar Grid */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)'}}>
              {days.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} style={{minHeight:100, background:'rgba(0,0,0,0.1)', borderRight:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)'}} />;
                const dateStr = getDateStr(day);
                const dayEvents = eventsForDate(dateStr);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                return (
                  <div key={day} onClick={() => setSelectedDate(isSelected ? null : dateStr)} style={{
                    minHeight:100, padding:8, cursor:'pointer',
                    borderRight:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)',
                    background: isSelected ? 'rgba(229,51,42,0.1)' : isToday ? 'rgba(229,51,42,0.08)' : 'transparent',
                  }}>
                    <div style={{
                      fontSize:14, fontWeight: isToday ? 800 : 600,
                      color: isToday ? '#e5332a' : '#e5e7eb',
                      marginBottom:4,
                      ...(isToday ? {background:'#e5332a', color:'white', width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'} : {}),
                    }}>
                      {day}
                    </div>
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{
                        fontSize:10, padding:'2px 6px', borderRadius:4, marginBottom:2,
                        background: typeColor(ev.type), color: statusColor(ev.status),
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        borderLeft: `3px solid ${statusColor(ev.status)}`,
                      }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div style={{fontSize:10, color:'#9aa3b2', paddingLeft:6}}>+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Week View */
          <div style={{background:'rgba(0,0,0,0.2)', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden'}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)'}}>
              {weekDays.map(d => {
                const dateStr = d.toISOString().split('T')[0];
                const dayEvents = eventsForDate(dateStr);
                const isToday = dateStr === today;
                return (
                  <div key={dateStr} style={{borderRight:'1px solid rgba(255,255,255,0.05)', minHeight:400}}>
                    <div style={{padding:12, textAlign:'center', borderBottom:'1px solid rgba(255,255,255,0.1)', background: isToday ? 'rgba(229,51,42,0.1)' : 'transparent'}}>
                      <div style={{fontSize:12, color:'#9aa3b2', fontWeight:600}}>{d.toLocaleDateString('en', { weekday: 'short' })}</div>
                      <div style={{fontSize:20, fontWeight:800, color: isToday ? '#e5332a' : '#e5e7eb'}}>{d.getDate()}</div>
                    </div>
                    <div style={{padding:8}}>
                      {dayEvents.map(ev => (
                        <div key={ev.id} onClick={() => setSelectedDate(dateStr)} style={{
                          fontSize:12, padding:'8px 10px', borderRadius:6, marginBottom:6, cursor:'pointer',
                          background: typeColor(ev.type), borderLeft: `3px solid ${statusColor(ev.status)}`,
                        }}>
                          <div style={{fontWeight:700, color:'#e5e7eb', marginBottom:2}}>{ev.time}</div>
                          <div style={{color:'#9aa3b2', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ev.title}</div>
                          {ev.customer && <div style={{fontSize:10, color:'#6b7280', marginTop:2}}>{ev.customer}</div>}
                        </div>
                      ))}
                      {dayEvents.length === 0 && (
                        <div style={{textAlign:'center', padding:20, color:'#4b5563', fontSize:12}}>No events</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Day Detail Panel */}
        {selectedDate && selectedEvents.length > 0 && (
          <div style={{marginTop:24, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <h3 style={{fontSize:18, fontWeight:700, color:'#e5e7eb', margin:0}}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                <span style={{fontSize:14, color:'#9aa3b2', fontWeight:400, marginLeft:12}}>{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</span>
              </h3>
              <button onClick={() => setSelectedDate(null)} style={{background:'none', border:'none', color:'#9aa3b2', fontSize:18, cursor:'pointer'}}><FaTimes style={{marginRight:4}} /></button>
            </div>
            <div style={{display:'grid', gap:12}}>
              {selectedEvents.map(ev => (
                <div key={ev.id} style={{display:'flex', gap:16, alignItems:'center', padding:16, background:'rgba(255,255,255,0.05)', borderRadius:8, borderLeft: `4px solid ${statusColor(ev.status)}`}}>
                  <div style={{minWidth:60, textAlign:'center'}}>
                    <div style={{fontSize:14, fontWeight:700, color:'#e5e7eb'}}>{ev.time}</div>
                    <div style={{
                      fontSize:10, fontWeight:600, textTransform:'uppercase',
                      color: ev.type === 'appointment' ? '#e5332a' : '#a78bfa',
                    }}>{ev.type === 'appointment' ? 'APPT' : 'WO'}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15, fontWeight:600, color:'#e5e7eb'}}>{ev.title}</div>
                    {ev.customer && <div style={{fontSize:13, color:'#9aa3b2'}}>{ev.customer}{ev.service ? `  ${ev.service}` : ''}</div>}
                  </div>
                  <span style={{padding:'4px 10px', borderRadius:12, fontSize:11, fontWeight:700, background:`${statusColor(ev.status)}20`, color: statusColor(ev.status), textTransform:'uppercase'}}>
                    {ev.status}
                  </span>
                  <Link href={ev.type === 'appointment' ? `/shop/home` : `/workorders/${ev.id}`} style={{padding:'6px 12px', background:'#e5332a', color:'white', borderRadius:6, fontSize:12, fontWeight:600, textDecoration:'none'}}>
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{marginTop:24, display:'flex', gap:24, flexWrap:'wrap'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{width:12, height:12, borderRadius:3, background:'rgba(229,51,42,0.3)', border:'2px solid #e5332a'}} />
            <span style={{fontSize:12, color:'#9aa3b2'}}>Appointment</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{width:12, height:12, borderRadius:3, background:'rgba(168,85,247,0.3)', border:'2px solid #a78bfa'}} />
            <span style={{fontSize:12, color:'#9aa3b2'}}>Work Order</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <div style={{width:8, height:8, borderRadius:'50%', background:'#f59e0b'}} /><span style={{fontSize:11, color:'#9aa3b2'}}>Pending</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <div style={{width:8, height:8, borderRadius:'50%', background:'#e5332a'}} /><span style={{fontSize:11, color:'#9aa3b2'}}>In Progress</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <div style={{width:8, height:8, borderRadius:'50%', background:'#22c55e'}} /><span style={{fontSize:11, color:'#9aa3b2'}}>Completed</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <div style={{width:8, height:8, borderRadius:'50%', background:'#ef4444'}} /><span style={{fontSize:11, color:'#9aa3b2'}}>Cancelled</span>
          </div>
        </div>
      </div>
    </div>
  );
}

