'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

export default function CustomerRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/customer/dashboard' as Route);
  }, [router]);
  
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:18}}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Customer Redirect</h1>
      Redirecting to Customer Portal...
    </div>
  );
}
