"use client";

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import IdleTimeoutProvider from '@/components/IdleTimeoutProvider';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import OnboardingWrapper from '@/components/OnboardingWrapper';

export default function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <IdleTimeoutProvider>
        <KeyboardShortcuts />
        <OnboardingWrapper>
          {children}
        </OnboardingWrapper>
      </IdleTimeoutProvider>
    </AuthProvider>
  );
}
