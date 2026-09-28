'use client';

import { useEffect, useState } from 'react';
import { usePhrase } from '@/lib/usePhrase';
import Link from 'next/link';
import { ROLE_HOME } from '@/lib/roleConfig';

export default function NotFoundPage() {
  const say = usePhrase();
  const [home, setHome] = useState('/auth/login');
  useEffect(() => {
    const role = localStorage.getItem('userRole') || '';
    setHome(ROLE_HOME[role] || '/auth/login');
  }, []);
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#e5e7eb', background: '#000', minHeight: '100vh' }}>
      <h1>{say("404  -  Not Found")}</h1>
      <p>{say("The requested page was not found.")}</p>
      <Link href={home as never} data-not-found-home="1" style={{ color: '#e5332a', fontWeight: 700 }}>
        {say("Go to your home")}
      </Link>
    </div>
  );
}
