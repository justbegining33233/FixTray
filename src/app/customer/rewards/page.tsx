'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useRequireAuth } from '@/contexts/AuthContext';

interface Reward {
  id: string;
  claimed: boolean;
  earned: boolean;
  name: string;
  value: string;
  description: string;
  expires: string;
  progress?: number;
  total?: number;
}

interface HistoryEntry {
  id: string;
  description: string;
  points: number;
  date: string;
}

export default function Rewards() {
  useRequireAuth(['customer']);
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    fetch('/api/customers/rewards', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setLoyaltyPoints(data.loyaltyPoints ?? 0);
          setRewards(data.rewards ?? []);
          setHistory(data.history ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/auth/login' as Route);
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Rewards</div>
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
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>My Rewards</h1>

        {/* Current Points */}
        <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginBottom:32}}>
          <h2 style={{fontSize:24, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Current Balance</h2>
          <div style={{display:'flex', alignItems:'center', gap:24}}>
            <div>
              <div style={{fontSize:36, fontWeight:700, color:'#e5332a'}}>{loyaltyPoints}</div>
              <div style={{fontSize:14, color:'#9aa3b2'}}>Loyalty Points</div>
            </div>
            <div style={{flex:1}}>
              {(() => {
                const nextThreshold = loyaltyPoints >= 1000 ? null : loyaltyPoints >= 200 ? 1000 : 200;
                const prevThreshold = loyaltyPoints >= 1000 ? 1000 : loyaltyPoints >= 200 ? 200 : 0;
                const pct = nextThreshold === null
                  ? 100
                  : nextThreshold > prevThreshold
                  ? Math.min(100, Math.round(((loyaltyPoints - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
                  : 100;
                return (
                  <>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                      <span style={{fontSize:14, color:'#e5e7eb'}}>Progress to next reward</span>
                      <span style={{fontSize:14, color:'#9aa3b2'}}>{loyaltyPoints} / {nextThreshold ?? loyaltyPoints}</span>
                    </div>
                    <div style={{width:'100%', height:8, background:'rgba(255,255,255,0.1)', borderRadius:4}}>
                      <div style={{width:`${pct}%`, height:'100%', background:'#e5332a', borderRadius:4}}></div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Available Rewards */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:24}}>
          {rewards.map(reward => (
            <div key={reward.id} style={{
              background:'rgba(0,0,0,0.3)',
              border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:12,
              padding:24,
              opacity: reward.claimed ? 0.6 : 1
            }}>
              <div style={{marginBottom:16}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                  <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{reward.name}</h3>
                  {reward.claimed && (
                    <span style={{padding:'4px 8px', background:'rgba(34,197,94,0.2)', color:'#22c55e', borderRadius:6, fontSize:12, fontWeight:600}}>
                      Claimed
                    </span>
                  )}
                </div>
                <div style={{fontSize:18, color:'#e5332a', fontWeight:600, marginBottom:8}}>{reward.value}</div>
                <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{reward.description}</div>
                <div style={{fontSize:12, color:'#6b7280'}}>Expires: {reward.expires}</div>
                {reward.progress && (
                  <div style={{marginTop:12}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                      <span style={{fontSize:12, color:'#9aa3b2'}}>Progress</span>
                      <span style={{fontSize:12, color:'#9aa3b2'}}>{reward.progress} / {reward.total}</span>
                    </div>
                    <div style={{width:'100%', height:6, background:'rgba(255,255,255,0.1)', borderRadius:3}}>
                      <div style={{width:`${reward.total ? (reward.progress / reward.total) * 100 : 0}%`, height:'100%', background:'#e5332a', borderRadius:3}}></div>
                    </div>
                  </div>
                )}
              </div>
              {!reward.claimed && (
                <button
                  onClick={async () => {
                    if (!reward.earned) return;
                    try {
                      const token = localStorage.getItem('token');
                      const r = await fetch('/api/customers/rewards', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ rewardId: reward.id }),
                      });
                      if (r.ok) {
                        setRewards(prev => prev.map(rw => rw.id === reward.id ? { ...rw, claimed: true } : rw));
                      }
                    } catch { /* ignore */ }
                  }}
                  style={{
                  width:'100%',
                  padding:'12px',
                  background: reward.earned ? '#22c55e' : 'rgba(255,255,255,0.1)',
                  color: reward.earned ? 'white' : '#9aa3b2',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor: reward.earned ? 'pointer' : 'not-allowed'
                }}>
                  {reward.earned ? 'Claim Reward' : `${(reward.total ?? 0) - loyaltyPoints > 0 ? `${(reward.total ?? 0) - loyaltyPoints} pts needed` : 'Continue Earning'}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Points History */}
        {history.length > 0 && (
          <div style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:24, marginTop:32}}>
            <h2 style={{fontSize:20, fontWeight:700, color:'#e5e7eb', marginBottom:16}}>Points History</h2>
            <div style={{display:'grid', gap:8}}>
              {history.map(entry => (
                <div key={entry.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'rgba(255,255,255,0.04)', borderRadius:8}}>
                  <div>
                    <div style={{fontSize:14, color:'#e5e7eb'}}>{entry.description}</div>
                    <div style={{fontSize:12, color:'#9aa3b2'}}>{entry.date}</div>
                  </div>
                  <div style={{fontSize:16, fontWeight:700, color:'#a855f7'}}>+{entry.points} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div style={{textAlign:'center', padding:60, color:'#9aa3b2'}}>Loading rewards...</div>
        )}

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
    </div>
  );
}
