"use client";

import { useEffect, useRef } from 'react';

const INACTIVITY_MS_BEFORE_WARNING = 10 * 60 * 1000; // 10 minutes idle before warning
const WARN_MS = 30 * 1000;                           // 30-second countdown after warning

interface Options {
  onIdle: () => void;       // called when countdown hits 0 → logout
  onWarning: () => void;    // called 30s before logout
  onActive: () => void;     // called when user activity resumes during warning
  enabled: boolean;
}

export function useIdleTimeout({ onIdle, onWarning, onActive, enabled }: Options) {
  // Store callbacks in refs so timer closures always see the latest version
  // without being listed as deps (prevents timer reset on every render)
  const onIdleRef   = useRef(onIdle);
  const onWarnRef   = useRef(onWarning);
  const onActiveRef = useRef(onActive);
  const enabledRef  = useRef(enabled);

  useEffect(() => {
    onIdleRef.current   = onIdle;
    onWarnRef.current   = onWarning;
    onActiveRef.current = onActive;
    enabledRef.current  = enabled;
  });

  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWarning   = useRef(false);
  const handlerRef  = useRef<(() => void) | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (warnTimer.current) { clearTimeout(warnTimer.current); warnTimer.current = null; }
      if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    };

    const resetTimers = () => {
      if (!enabledRef.current) return;
      clearTimers();
      if (isWarning.current) {
        isWarning.current = false;
        onActiveRef.current();
      }
      warnTimer.current = setTimeout(() => {
        isWarning.current = true;
        onWarnRef.current();
        idleTimer.current = setTimeout(() => {
          isWarning.current = false;
          onIdleRef.current();
        }, WARN_MS);
      }, INACTIVITY_MS_BEFORE_WARNING);
    };

    // Remove previous handler if any
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    if (handlerRef.current) {
      events.forEach(e => window.removeEventListener(e, handlerRef.current!));
    }

    if (!enabled) {
      clearTimers();
      return;
    }

    handlerRef.current = resetTimers;
    events.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));
    resetTimers(); // start the initial timer

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers));
      clearTimers();
    };
  // Only re-run when enabled changes — NOT when callbacks change
   
  }, [enabled]);
}
