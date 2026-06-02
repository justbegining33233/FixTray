"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import IdleWarningModal from '@/components/IdleWarningModal';

const WARN_SECONDS = 30;

export default function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  // Called by hook when idle timer fires <FaArrowRight style={{marginRight:4}} /> force logout
  const handleIdle = useCallback(() => {
    stopCountdown();
    setShowWarning(false);
    logout();
   
  }, [logout]);

  // Called by hook when 30s warning period starts
  const handleWarning = useCallback(() => {
    setSecondsLeft(WARN_SECONDS);
    setShowWarning(true);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { stopCountdown(); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  // Called by hook when user moves/types during the warning period
  const handleActive = useCallback(() => {
    stopCountdown();
    setShowWarning(false);
    setSecondsLeft(WARN_SECONDS);
  }, []);

  // "Stay logged in" button  -  dispatch a real activity event so the
  // hook resets its internal timers and calls handleActive for us
  const handleStay = () => {
    window.dispatchEvent(new MouseEvent('mousemove'));
  };

  useIdleTimeout({
    onWarning: handleWarning,
    onIdle: handleIdle,
    onActive: handleActive,
    enabled: isAuthenticated,
  });

  // Clean up interval on unmount
  useEffect(() => () => stopCountdown(), []);

  return (
    <>
      {children}
      {showWarning && isAuthenticated && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onStay={handleStay}
          onLogout={handleIdle}
        />
      )}
    </>
  );
}
