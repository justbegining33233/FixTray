'use client';

import { createContext, useContext } from 'react';

interface NativeContextValue {
  isNative: boolean;
  platform: 'android' | 'ios' | null;
  /** True when the server detected a mobile User-Agent (phones & tablets). */
  isMobileUA: boolean;
}

const NativeContext = createContext<NativeContextValue>({
  isNative: false,
  platform: null,
  isMobileUA: false,
});

export function NativeProvider({
  children,
  isNative,
  platform,
  isMobileUA = false,
}: {
  children: React.ReactNode;
  isNative: boolean;
  platform: 'android' | 'ios' | null;
  isMobileUA?: boolean;
}) {
  return (
    <NativeContext.Provider value={{ isNative, platform, isMobileUA }}>
      {children}
    </NativeContext.Provider>
  );
}

export function useIsNative(): boolean {
  return useContext(NativeContext).isNative;
}

export function useNativePlatform(): 'android' | 'ios' | null {
  return useContext(NativeContext).platform;
}

export function useIsMobileUA(): boolean {
  return useContext(NativeContext).isMobileUA;
}
