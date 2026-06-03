'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/contexts/AuthContext';
import { FaCheck, FaHourglassHalf, FaMapMarkerAlt, FaPhone, FaRegStar, FaSearch, FaStar } from 'react-icons/fa';

interface Shop {
  id: string;
  name: string;
  distance: string;
  rating: number;
  address: string;
  zipCode: string;
  services: string[];
  completedJobs?: number;
  phone?: string;
}

export default function FindShops() {
  useRequireAuth(['customer']);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'zip'>('name'); // will be auto-detected only
  const [shops, setShops] = useState<Shop[]>([]);
    const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingFavorites, setTogglingFavorites] = useState<Set<string>>(new Set());
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    fetchShops();
      fetchFavorites();
  }, []);

  const fetchShops = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers/shops', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops || []);
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    } finally {
      setLoading(false);
    }
  };

    const fetchFavorites = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/customers/favorites', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setFavorites(data.favorites || []);
        }
      } catch (error) {
        console.error('Error fetching favorites:', error);
      }
    };

    const toggleFavorite = async (shopId: string) => {
      if (togglingFavorites.has(shopId)) return; // Prevent double-clicks

      try {
        setTogglingFavorites(prev => new Set(prev).add(shopId));
        const token = localStorage.getItem('token');
        const isCurrentlyFavorite = favorites.some(fav => fav.shop?.id === shopId);

        // Optimistic update - immediately update UI
        if (isCurrentlyFavorite) {
          const favoriteRecord = favorites.find(fav => fav.shop?.id === shopId);
          if (favoriteRecord) {
            setFavorites(prev => prev.filter(fav => fav.favoriteId !== favoriteRecord.favoriteId));
          }
        } else {
          // For adding, we'll add a temporary placeholder and replace it with real data
          const tempFavorite = {
            favoriteId: `temp-${shopId}`,
            createdAt: new Date().toISOString(),
            shop: null // Will be filled by the API response
          };
          setFavorites(prev => [...prev, tempFavorite]);
        }

        if (isCurrentlyFavorite) {
          // Find the favorite record ID
          const favoriteRecord = favorites.find(fav => fav.shop?.id === shopId);
          if (!favoriteRecord) return;

          // Remove from favorites
          const res = await fetch(`/api/customers/favorites/${favoriteRecord.favoriteId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (!res.ok) {
            // Revert optimistic update on failure
            console.error('Failed to remove favorite');
            fetchFavorites(); // Refetch to restore correct state
          }
        } else {
          // Add to favorites
          const res = await fetch('/api/customers/favorites', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ shopId })
          });
          if (res.ok) {
            const newFavorite = await res.json();
            // Replace temp favorite with real data
            setFavorites(prev => prev.map(fav =>
              fav.favoriteId === `temp-${shopId}` ? newFavorite : fav
            ));
          } else {
            // Revert optimistic update on failure
            console.error('Failed to add favorite');
            setFavorites(prev => prev.filter(fav => fav.favoriteId !== `temp-${shopId}`));
          }
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);
        // Revert any optimistic updates on error
        fetchFavorites();
      } finally {
        setTogglingFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(shopId);
          return newSet;
        });
      }
    };

  const handleSignOut = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    window.location.href = '/auth/login';
  };

  const filteredShops = shops.filter(shop => {
    if (!searchTerm) return true;
    
    if (searchType === 'zip') {
      // Search by zip code - exact match or starts with
      return shop.zipCode?.startsWith(searchTerm);
    } else {
      // Search by shop name only
      return shop.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
  });

  // Check if input looks like a zip code (5 digits)
  const detectSearchType = (value: string) => {
    const isZipLike = /^\d+$/.test(value);
    if (isZipLike) {
      setSearchType('zip');
    } else {
      setSearchType('name');
    }
  };

  return (
    <div style={{minHeight:'100vh', background: 'transparent'}}>
      {/* Header */}
      <div style={{background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(229,51,42,0.3)', padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:24}}>
          <Link href="/customer/dashboard" style={{fontSize:24, fontWeight:900, color:'#e5332a', textDecoration:'none'}}>FixTray</Link>
          <div>
            <div style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>Customer Portal</div>
            <div style={{fontSize:12, color:'#9aa3b2'}}>Find Shops</div>
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
        <div style={{marginBottom:20}}>
          <Link href="/customer/dashboard" style={{
            display:'inline-flex',
            alignItems:'center',
            color:'#3b82f6',
            textDecoration:'none',
            fontSize:14,
            fontWeight:600,
            padding:'8px 16px',
            background:'rgba(59,130,246,0.1)',
            borderRadius:8,
            border:'1px solid rgba(59,130,246,0.3)'
          }}>
            Back to Dashboard
          </Link>
        </div>
        <h1 style={{fontSize:32, fontWeight:700, color:'#e5e7eb', marginBottom:32}}>Find Auto Shops</h1>

        {/* Single Search Bar, auto-detects zip vs name/service */}
        <div style={{marginBottom:32}}>
          <div style={{position:'relative'}}>
            <input
              type="text"
              placeholder="(Search by shop name or zip code...)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                detectSearchType(e.target.value);
              }}
              style={{
                width:'100%',
                padding:'16px 20px',
                background:'rgba(0,0,0,0.3)',
                border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:12,
                color:'#e5e7eb',
                fontSize:16,
                outline:'none'
              }}
              />
          </div>
        </div>

        {/* Favorite Shops - Show by default when not searching */}
        {!loading && !searchTerm && favorites.length > 0 && (
          <div style={{marginBottom:32}}>
            <h2 style={{fontSize:22, fontWeight:700, color:'#e5e7eb', marginBottom:16}}><FaStar style={{marginRight:4}} /> Your Favorite Shops</h2>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:24}}>
              {favorites.map(fav => fav.shop && (
                <div key={fav.shop.id} style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,215,0,0.3)', borderRadius:12, padding:24}}>
                  <div style={{marginBottom:16}}>
                    <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>{fav.shop.shopName}</h3>
                    <span style={{fontSize:13, color:'#9aa3b2'}}><FaMapMarkerAlt style={{marginRight:4}} /> {fav.shop.zipCode}</span>
                    <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{fav.shop.address}</div>
                    {fav.shop.phone && (
                      <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>
                        <FaPhone style={{marginRight:4}} /> {fav.shop.phone}
                      </div>
                    )}
                    {fav.shop.services && fav.shop.services.length > 0 && (
                      <div style={{fontSize:13, color:'#e5e7eb', marginBottom:8}}>
                        {fav.shop.services.slice(0,6).map((service: any, idx: number) => (
                          <span key={idx} style={{marginRight:8}}>{service.serviceName}</span>
                        ))}
                        {fav.shop.services.length > 6 && (
                          <span style={{color:'#9aa3b2'}}>+{fav.shop.services.length-6} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex', gap:12}}>
                    <Link href={`/customer/shop/${fav.shop.id}`} style={{
                      flex:1,
                      padding:'12px',
                      background:'rgba(229,51,42,0.1)',
                      color:'#e5332a',
                      border:'1px solid rgba(229,51,42,0.3)',
                      borderRadius:8,
                      fontSize:14,
                      fontWeight:600,
                      cursor:'pointer',
                      textDecoration:'none',
                      textAlign:'center'
                    }}>
                      View Details
                    </Link>
                    <Link href={`/customer/appointments/new?shopId=${fav.shop.id}`} style={{
                      flex:1,
                      padding:'12px',
                      background:'rgba(34,197,94,0.1)',
                      color:'#22c55e',
                      border:'1px solid rgba(34,197,94,0.3)',
                      borderRadius:8,
                      fontSize:14,
                      fontWeight:600,
                      cursor:'pointer',
                      textDecoration:'none',
                      textAlign:'center'
                    }}>
                      Book Appointment
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results - Only show when searching */}
        {!loading && searchTerm && filteredShops.length > 0 && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', gap:24}}>
            {filteredShops.map(shop => {
              const isFavorite = favorites.some(fav => fav.shop?.id === shop.id);
              return (
                <div key={shop.id} style={{background:'rgba(0,0,0,0.3)', border:`1px solid ${isFavorite ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius:12, padding:24, transition:'all 0.2s'}}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(229,51,42,0.4)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    const currentIsFavorite = favorites.some(fav => fav.shop?.id === shop.id);
                    e.currentTarget.style.borderColor = currentIsFavorite ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{marginBottom:16}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span
                          onClick={() => !togglingFavorites.has(shop.id) && toggleFavorite(shop.id)}
                          style={{
                            cursor: togglingFavorites.has(shop.id) ? 'not-allowed' : 'pointer',
                            fontSize:20,
                            color: isFavorite ? '#f59e0b' : '#6b7280',
                            transition:'color 0.2s',
                            opacity: togglingFavorites.has(shop.id) ? 0.5 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (!togglingFavorites.has(shop.id)) {
                              e.currentTarget.style.color = isFavorite ? '#f59e0b' : '#9ca3af';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!togglingFavorites.has(shop.id)) {
                              const currentIsFavorite = favorites.some(fav => fav.shop?.id === shop.id);
                              e.currentTarget.style.color = currentIsFavorite ? '#f59e0b' : '#6b7280';
                            }
                          }}
                        >
                          {togglingFavorites.has(shop.id) ? <FaHourglassHalf style={{marginRight:4}} /> : (isFavorite ? <FaStar style={{marginRight:4}} /> : <FaRegStar style={{marginRight:4}} />)}
                        </span>
                        <h3 style={{fontSize:20, fontWeight:700, color:'#e5e7eb'}}>
                          {shop.name}
                        </h3>
                      </div>
                      {shop.rating > 0 && (
                        <span style={{padding:'4px 8px', background:'rgba(245,158,11,0.2)', color:'#f59e0b', borderRadius:6, fontSize:12, fontWeight:700}}>
                          <FaStar style={{marginRight:4}} /> {shop.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:12, flexWrap:'wrap'}}>
                      {shop.zipCode && (
                        <span style={{
                          fontSize:13,
                          color: searchType === 'zip' && searchTerm && shop.zipCode.startsWith(searchTerm) ? '#e5332a' : '#9aa3b2',
                          fontWeight: searchType === 'zip' && searchTerm && shop.zipCode.startsWith(searchTerm) ? 700 : 400,
                          background: searchType === 'zip' && searchTerm && shop.zipCode.startsWith(searchTerm) ? 'rgba(229,51,42,0.1)' : 'transparent',
                          padding: searchType === 'zip' && searchTerm && shop.zipCode.startsWith(searchTerm) ? '2px 8px' : 0,
                          borderRadius:4
                        }}>
                          <FaMapMarkerAlt style={{marginRight:4}} /> {shop.zipCode}
                        </span>
                      )}
                      {shop.completedJobs !== undefined && (
                        <span style={{fontSize:13, color:'#22c55e', fontWeight:600}}>
                          <FaCheck style={{marginRight:4}} /> {shop.completedJobs} jobs completed
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>{shop.address}</div>
                    {shop.phone && (
                      <div style={{fontSize:14, color:'#9aa3b2', marginBottom:8}}>
                        <FaPhone style={{marginRight:4}} /> {shop.phone}
                      </div>
                    )}
                    {shop.services && shop.services.length > 0 && (
                      <div style={{fontSize:13, color:'#e5e7eb', marginBottom:8}}>
                        {shop.services.slice(0,6).map((service, idx) => (
                          <span key={idx} style={{marginRight:8}}>{service}</span>
                        ))}
                        {shop.services.length > 6 && (
                          <span style={{color:'#9aa3b2'}}>+{shop.services.length-6} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex', gap:12}}>
                    <Link href={`/customer/shop/${shop.id}`} style={{
                      flex:1,
                      padding:'12px',
                      background:'rgba(229,51,42,0.1)',
                      color:'#e5332a',
                      border:'1px solid rgba(229,51,42,0.3)',
                      borderRadius:8,
                      fontSize:14,
                      fontWeight:600,
                      cursor:'pointer',
                      textDecoration:'none',
                      textAlign:'center'
                    }}>
                      View Details
                    </Link>
                    <Link href={`/customer/appointments/new?shopId=${shop.id}`} style={{
                      flex:1,
                      padding:'12px',
                      background:'rgba(34,197,94,0.1)',
                      color:'#22c55e',
                      border:'1px solid rgba(34,197,94,0.3)',
                      borderRadius:8,
                      fontSize:14,
                      fontWeight:600,
                      cursor:'pointer',
                      textDecoration:'none',
                      textAlign:'center'
                    }}>
                      Book Appointment
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Favorites - Show when not searching and no favorites */}
        {!loading && !searchTerm && favorites.length === 0 && (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
            <div style={{fontSize:48, marginBottom:16}}><FaStar style={{marginRight:4}} /></div>
            <div style={{fontSize:18, marginBottom:8}}>No favorite shops yet</div>
            <div style={{fontSize:14}}>
              Search for shops and mark them as favorites to see them here.
            </div>
          </div>
        )}

        {/* No Results - Only show when searching and no matches */}
        {!loading && searchTerm && filteredShops.length === 0 && (
          <div style={{textAlign:'center', padding:40, color:'#9aa3b2'}}>
            <div style={{fontSize:48, marginBottom:16}}><FaSearch style={{marginRight:4}} /></div>
            <div style={{fontSize:18, marginBottom:8}}>No shops found</div>
            <div style={{fontSize:14}}>
              {searchType === 'zip'
                ? `No shops found in zip code "${searchTerm}". Try a different area.`
                : `No shops match "${searchTerm}". Try a different search term.`}
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div style={{marginTop:32, textAlign:'center'}}>
          <Link href="/customer/home" style={{
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
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

