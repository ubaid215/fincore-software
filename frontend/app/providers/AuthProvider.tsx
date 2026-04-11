// modules/auth/components/AuthProvider.tsx (UPDATED)
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/modules/auth/store/auth.store';
import { useMe } from '@/modules/auth/hooks/useMe';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isInitialized, isLoading, setInitialized, refreshSession, accessToken } = useAuthStore();
  const { refetch } = useMe();

  useEffect(() => {
    const initAuth = async () => {
      // Only try to refresh if we don't have an access token
      if (!accessToken) {
        const refreshed = await refreshSession();
        if (refreshed) {
          await refetch();
        } else {
          // No valid session, but still mark as initialized
          setInitialized(true);
        }
      } else {
        // We have a token, fetch user data
        await refetch();
        setInitialized(true);
      }
    };

    initAuth();
  }, []); // Remove dependencies to run once

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}