'use client';
import { FaArrowLeft, FaArrowRight, FaClock } from 'react-icons/fa';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';

import { useRequireAuth } from '@/contexts/AuthContext';

function formatTime(dt?: string | Date | null) {
  if (!dt) return '-';
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function TechTimesheet() {
  const { user, isLoading } = useRequireAuth(['tech']);
  const [entries, setEntries] = useState<any[]>([]);
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(false);
  const refreshRef = useRef<number | null>(null);


  // edit state for inline row editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({ notes: '', workOrderId: '' });
  const [timesheetMsg, setTimesheetMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const [approveConfirmId, setApproveConfirmId] = useState<string|null>(null);



  useEffect(() => {
    if (user) fetchEntries();
    // refresh every 20s so active timers update
    refreshRef.current = window.setInterval(() => { if (user) fetchEntries(false); }, 20000);
    return () => { if (refreshRef.current) window.clearInterval(refreshRef.current); };
     
  }, [user, range]);

  const getRangeDates = () => {
    const now = new Date();
    if (range === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Sunday
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23,59,59,999);
      return { start, end };
    }

    // month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0,0,0,0);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0);
    end.setHours(23,59,59,999);
    return { start, end };
  };

  const fetchEntries = async (showLoading = true) => {
    if (!user) return;
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('token');
      const { start, end } = getRangeDates();
      const res = await fetch(`/api/time-tracking?techId=${user.id}&startDate=${start.toISOString()}&endDate=${end.toISOString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { timeEntries } = await res.json();
        setEntries(timeEntries || []);
      } else {
        console.error('Failed to load time entries');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const totals = useMemo(() => {
    let totalMs = 0;
    const now = new Date();

    entries.forEach((e) => {
      if (e.clockOut) {
        const ms = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime());
        totalMs += ms;
      } else {
        // active entry - count up to now
        totalMs += (now.getTime() - new Date(e.clockIn).getTime());
      }
    });

    // Total clocked-in hours (pay)
    let totalHours = 0;
    if (entries.length && entries.every(e => e.hoursWorked !== null && e.hoursWorked !== undefined)) {
      totalHours = entries.reduce((acc, e) => acc + (e.hoursWorked || ((e.clockOut ? (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime())/(1000*60*60) : (now.getTime() - new Date(e.clockIn).getTime())/(1000*60*60)))), 0);
    } else {
      totalHours = totalMs / (1000*60*60);
    }

    // Billable hours = sum of hours linked to a workOrderId
    const billableHours = entries.reduce((acc, e) => {
      if (!e.workOrderId) return acc;
      const ci = new Date(e.clockIn).getTime();
      const co = e.clockOut ? new Date(e.clockOut).getTime() : now.getTime();
      return acc + ((co - ci) / (1000*60*60));
    }, 0);

    const nonBillableHours = Math.max(0, totalHours - billableHours);

    const hourly = (user as any)?.hourlyRate || 0;
    const billableEst = billableHours * hourly;

    return { totalHours, billableHours, nonBillableHours, billableEst };
  }, [entries, user]);

  if (isLoading) {
    return (
      <div style={{minHeight:'100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{color: '#e5e7eb', fontSize: 18}}>Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const { start, end } = getRangeDates();
  // Only show entries in the detailed table that are meaningful there.
  // Non-billable / empty rows remain visible in the compact Pay Period table above.
  const detailedEntries = entries.filter(e => e.workOrderId || e.isPto || (e.notes && e.notes.toString().trim() !== ''));

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'20px 32px'}}>
        <div style={{maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <Link href="/tech/all-tools" style={{color:'#e5332a', textDecoration:'none', fontSize:14, fontWeight:600, marginBottom:8, display:'inline-block'}}>
              <FaArrowLeft style={{marginRight:4}} /> Back to Tools
            </Link>
            <h1 style={{fontSize:28, fontWeight:700, color:'#e5e7eb', marginBottom:8}}><FaClock style={{marginRight:4}} /> Time Tracking</h1>
            <p style={{fontSize:14, color:'#9aa3b2'}}>Track your work hours, breaks, and job time for payroll</p>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Range</div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={() => setRange('week')} style={{padding:'8px 12px', borderRadius:8, background: range==='week'? '#000000':'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb'}}>This Week</button>
              <button onClick={() => setRange('month')} style={{padding:'8px 12px', borderRadius:8, background: range==='month'? '#000000':'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb'}}>This Month</button>
            </div>
            <div style={{fontSize:12, color:'#9aa3b2', marginTop:6}}>{start.toLocaleDateString()} <FaArrowRight style={{marginRight:4}} /> {end.toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:32, display:'grid', gridTemplateColumns: '1fr', gap:24}}>

          {/* Compact Hour Tracker (read-only) */}
          <div style={{marginBottom:8, padding:12, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div style={{fontSize:12, color:'#9aa3b2'}}>Clocked-in (pay)</div>
              <div style={{fontSize:18, fontWeight:700, color:'#e5e7eb'}}>{totals.totalHours.toFixed(2)} hrs</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12, color:'#9aa3b2'}}>Billable</div>
              <div style={{fontSize:16, fontWeight:700, color:'#e5e7eb'}}>{totals.billableHours.toFixed(2)} hrs</div>
            </div>
          </div>

        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <div>
              <h3 style={{margin:0, color:'#e5e7eb'}}>Timesheet</h3>
              <div style={{fontSize:12, color:'#9aa3b2'}}>Pay period: <strong style={{color:'#e5e7eb'}}>{start.toLocaleDateString()} <FaArrowRight style={{marginRight:4}} /> {end.toLocaleDateString()}</strong></div>
            </div>

            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12, color:'#9aa3b2'}}>Entries</div>
              <div style={{fontWeight:700, color:'#e5e7eb'}}>{entries.length} entries</div>
            </div>
          </div>

          <div style={{background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:12, overflow:'hidden'}}>
            {/* Pay period summary */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
              <div style={{fontSize:13, color:'#9aa3b2'}}>PAY PERIOD  -  <strong style={{color:'#e5e7eb'}}>{start.toLocaleDateString()} <FaArrowRight style={{marginRight:4}} /> {end.toLocaleDateString()}</strong></div>
              <div style={{fontSize:13, color:'#e5e7eb', fontWeight:700}}>TOTAL HOURS  -  {totals.totalHours.toFixed(2)} hrs</div>
            </div>

            {/* Compact pay-period table: Date | Clock In | Clock Out | Hours */}
            <div style={{padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
              <div style={{display:'grid', gridTemplateColumns:'120px 100px 100px 80px', gap:8, fontSize:13, color:'#9aa3b2', marginBottom:6}}>
                <div>Date</div>
                <div>Clock In</div>
                <div>Clock Out</div>
                <div style={{textAlign:'right'}}>Hours</div>
              </div>

              {entries.length === 0 && (
                <div style={{padding:12, color:'#9aa3b2'}}>No time entries for this period.</div>
              )}

              {entries.map((pe) => {
                const ci = new Date(pe.clockIn);
                const co = pe.clockOut ? new Date(pe.clockOut) : null;
                const now = new Date();
                const durationMs = co ? (co.getTime() - ci.getTime()) : (now.getTime() - ci.getTime());
                const hours = pe.hoursWorked ?? (durationMs / (1000*60*60));

                return (
                  <div key={pe.id} style={{display:'grid', gridTemplateColumns:'120px 100px 100px 80px', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.03)', alignItems:'center', color:'#e5e7eb'}}>
                    <div style={{fontSize:13, color:'#9aa3b2'}}>{ci.toLocaleDateString()}</div>
                    <div style={{fontWeight:600, fontFamily:'monospace'}}>{formatTime(ci)}</div>
                    <div style={{fontWeight:600, fontFamily:'monospace'}}>{co ? formatTime(co) : ' - '}</div>
                    <div style={{textAlign:'right', fontWeight:700}}>{hours.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>



            <div>
              {loading && <div style={{padding:24, color:'#9aa3b2'}}>Loading...</div>}
              {!loading && entries.length === 0 && <div style={{padding:24, color:'#9aa3b2'}}>No time entries for this period.</div>}

              {/* If there are entries but none qualify for the detailed view, show a brief note */}


              {detailedEntries.length > 0 && detailedEntries.map((e) => {
                const clockIn = new Date(e.clockIn);
                const clockOut = e.clockOut ? new Date(e.clockOut) : null;
                const now = new Date();
                const durationMs = clockOut ? (clockOut.getTime() - clockIn.getTime()) : (now.getTime() - clockIn.getTime());
                const hours = e.hoursWorked ?? (durationMs / (1000*60*60));

                const isEditing = editingId === e.id;

                return (
                  <div key={e.id} style={{display:'grid', gridTemplateColumns:'120px 1fr 120px', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.03)', alignItems:'center', fontSize:13, color:'#e5e7eb'}}>
                    {/* WO column */}
                    <div>
                      {isEditing ? (
                        <input value={editValues.workOrderId || ''} onChange={(ev) => setEditValues({...editValues, workOrderId: ev.target.value})} placeholder="WO id" style={{width:'100%', padding:6, borderRadius:6, border:'1px solid rgba(255,255,255,0.06)'}} />
                      ) : (
                        e.workOrderId ? (
                          <div style={{display:'flex', gap:8, alignItems:'center'}}>
                            <Link href={`/workorders/${e.workOrderId}`} style={{color:'#e5332a', fontWeight:700, textDecoration:'none'}}>{e.workOrderId}</Link>
                            <span style={{fontSize:11, background:'#052e16', color:'#bbf7d0', padding:'2px 6px', borderRadius:999}}>Billable</span>
                          </div>
                        ) : (
                          <div style={{display:'flex', gap:8, alignItems:'center'}}>
                            <span style={{color:'#9aa3b2'}}> - </span>
                            <span style={{fontSize:11, background:'rgba(255,255,255,0.03)', color:'#e5e7eb', padding:'2px 6px', borderRadius:999}}>Non-billable</span>
                          </div>
                        )
                      )}
                    </div>

                    {/* Notes column */}
                    <div style={{color:'#9aa3b2'}}>
                      {isEditing ? (
                        <input value={editValues.notes || ''} onChange={(ev) => setEditValues({...editValues, notes: ev.target.value})} placeholder="Notes" style={{width:'100%', padding:6, borderRadius:6, border:'1px solid rgba(255,255,255,0.06)'}} />
                      ) : (
                        e.notes || ' - '
                      )}
                    </div>

                    {/* Hours / Actions column */}
                    <div style={{textAlign:'right', display:'flex', gap:8, alignItems:'center', justifyContent:'flex-end'}}>
                      <div style={{minWidth:110, textAlign:'right', display:'flex', gap:8, alignItems:'center', justifyContent:'flex-end'}}>
                        <div style={{fontWeight:700}}>{hours.toFixed(2)}</div>
                        {e.workOrderId ? (
                          <div style={{fontSize:11, color:'#bbf7d0', background:'#052e16', padding:'2px 6px', borderRadius:999}}>Billable</div>
                        ) : e.isPto ? (
                          <div style={{fontSize:11, color:'#fde68a', background:'#2b2110', padding:'2px 6px', borderRadius:999}}>PTO</div>
                        ) : (
                          <div style={{fontSize:11, color:'#9aa3b2', background:'rgba(255,255,255,0.03)', padding:'2px 6px', borderRadius:999}}>Non-billable</div>
                        )}
                      </div>

                      {isEditing ? (
                        <>
                          <button onClick={async () => {
                            // Save
                            try {
                              const token = localStorage.getItem('token');
                              const res = await fetch(`/api/time-tracking/${e.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify(editValues),
                              });
                              if (res.ok) {
                                await fetchEntries();
                                setEditingId(null);
                                setEditValues({ notes: '', workOrderId: '' });
                              } else {
                                const { error } = await res.json();
                                setTimesheetMsg({type:'error',text:error || 'Failed to save'});
                              }
                            } catch (err) {
                              console.error(err);
                              setTimesheetMsg({type:'error',text:'Save failed'});
                            }
                          }} style={{padding:'6px 8px', borderRadius:6, background:'#10b981', color:'white', border:'none'}}>Save</button>
                          <button onClick={() => { setEditingId(null); setEditValues({ notes: '', workOrderId: '' }); }} style={{padding:'6px 8px', borderRadius:6, background:'transparent', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.04)'}}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(e.id); setEditValues({ notes: e.notes || '', workOrderId: e.workOrderId || '' }); }} style={{padding:'0', borderRadius:4, background:'transparent', color:'#e5332a', border:'none', fontSize:13, fontWeight:600, cursor:'pointer'}}>Edit</button>

                          {(user.role === 'manager' || user.role === 'admin') && (
                            <button onClick={() => setApproveConfirmId(e.id)} style={{padding:'6px 8px', borderRadius:6, background:'#f59e0b', color:'#1f2937', border:'none'}}>Approve</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billable hours  -  separate table for WO-linked time */}
          <div style={{marginTop:16, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:12, overflow:'hidden'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
              <div style={{fontSize:13, color:'#9aa3b2'}}>BILLABLE HOURS  -  <strong style={{color:'#e5e7eb'}}>{start.toLocaleDateString()} <FaArrowRight style={{marginRight:4}} /> {end.toLocaleDateString()}</strong></div>
              <div style={{fontSize:13, color:'#e5e7eb', fontWeight:700}}>{totals.billableHours.toFixed(2)} hrs</div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'120px 100px 100px 1fr', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.03)', fontSize:13, color:'#9aa3b2'}}>
              <div>Date</div>
              <div>Clock In</div>
              <div>Clock Out</div>
              <div>WO#</div>
            </div>

            <div>
              {entries.filter(en => en.workOrderId).length === 0 && (
                <div style={{padding:16, color:'#9aa3b2'}}>No billable time entries for this period.</div>
              )}

              {entries.filter(en => en.workOrderId).map((be) => {
                const ci = new Date(be.clockIn);
                const co = be.clockOut ? new Date(be.clockOut) : null;
                return (
                  <div key={be.id} style={{display:'grid', gridTemplateColumns:'120px 100px 100px 1fr', padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.03)', alignItems:'center', color:'#e5e7eb'}}>
                    <div style={{fontSize:13, color:'#9aa3b2'}}>{ci.toLocaleDateString()}</div>
                    <div style={{fontWeight:600, fontFamily:'monospace'}}>{formatTime(ci)}</div>
                    <div style={{fontWeight:600, fontFamily:'monospace'}}>{co ? formatTime(co) : <span style={{color:'#f59e0b'}}>In progress</span>}</div>
                    <div><Link href={`/workorders/${be.workOrderId}`} style={{color:'#e5332a', fontWeight:700, textDecoration:'none'}}>{be.workOrderId}</Link></div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {timesheetMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:timesheetMsg.type==='success'?'#dcfce7':'#fde8e8',color:timesheetMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {timesheetMsg.text}
          <button onClick={()=>setTimesheetMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}></button>
        </div>
      )}

      {approveConfirmId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#1f2937',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:32,maxWidth:400,width:'90%'}}>
            <h3 style={{color:'#e5e7eb',fontSize:18,fontWeight:700,marginBottom:12}}>Approve Entry?</h3>
            <p style={{color:'#9aa3b2',fontSize:14,marginBottom:24}}>Approve and lock this timesheet entry? This cannot be undone.</p>
            <div style={{display:'flex',gap:12}}>
              <button onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(`/api/time-tracking/${approveConfirmId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ approved: true, locked: true }),
                  });
                  if (res.ok) { await fetchEntries(); }
                  else { const { error } = await res.json(); setTimesheetMsg({type:'error',text:error || 'Failed to approve'}); }
                } catch (err) { console.error(err); setTimesheetMsg({type:'error',text:'Approve failed'}); }
                setApproveConfirmId(null);
              }} style={{flex:1,padding:'11px 0',background:'#f59e0b',color:'#1f2937',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>Approve</button>
              <button onClick={()=>setApproveConfirmId(null)} style={{flex:1,padding:'11px 0',background:'transparent',color:'#9aa3b2',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


