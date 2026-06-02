'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import UserOnboarding from '@/components/UserOnboarding';

export default function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, completeOnboarding } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      // Show onboarding for new users after a brief delay
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleOnboardingComplete = () => {
    completeOnboarding();
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    completeOnboarding();
    setShowOnboarding(false);
  };

  return (
    <>
      {children}
      {showOnboarding && user && (
        <UserOnboarding
          userRole={user.role as 'shop' | 'customer' | 'tech' | 'admin' | 'manager' | 'superadmin'}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </>
  );
}