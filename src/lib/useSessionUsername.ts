'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { decodeToken } from '@/lib/auth-client';

function readTokenUsername(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  const decoded = decodeToken(token);
  return typeof decoded?.username === 'string' ? decoded.username : null;
}

/** Username from the signed login token. The display name is not a substitute. */
export function useSessionUsername(): { username: string | null; ready: boolean } {
  const { user, isLoading } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setUsername(readTokenUsername());
    setReady(true);
  }, [isLoading, user?.id, user?.name]);

  return { username, ready };
}
