'use client';
// src/components/layout/AuthProvider.tsx
// Runs once on mount — restores access token from HttpOnly refresh cookie.
// Renders children immediately (no loading gate) to avoid flash.

import { useEffect } from 'react';
import { useAuth }   from '../../hooks/useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { hydrate, isHydrated } = useAuth();

  useEffect(() => {
    if (!isHydrated) {
      void hydrate();
    }
  }, []);

  return <>{children}</>;
}