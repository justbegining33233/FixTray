"use client";

import React, { Suspense } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import IdleTimeoutProvider from '@/components/IdleTimeoutProvider';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import OnboardingWrapper from '@/components/OnboardingWrapper';
import PlatformOwnerScopeGuard from '@/components/PlatformOwnerScopeGuard';
import RoleOfflineCache from '@/components/RoleOfflineCache';

export default function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <IdleTimeoutProvider>
        <KeyboardShortcuts />
        <PlatformOwnerScopeGuard />
        <Suspense fallback={null}>
          <RoleOfflineCache />
        </Suspense>
        <OnboardingWrapper>
          {children}
        </OnboardingWrapper>
      </IdleTimeoutProvider>
    </AuthProvider>
  );
}
