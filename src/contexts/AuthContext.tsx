
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import React, { createContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
// Loader2 import is removed as AuthProvider will no longer render its own loader directly.

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // True until onAuthStateChanged fires for the first time
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Auth state determined
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // This effect should only run AFTER initial auth loading is complete.
    if (loading) return;

    const isAuthPage = pathname.startsWith('/auth');
    const isLandingPage = pathname === '/';

    if (!user && !isAuthPage && !isLandingPage) {
      router.push('/auth/login');
    } else if (user && (isAuthPage || isLandingPage)) {
      router.push('/dashboard');
    }
  }, [user, loading, router, pathname]);

  const signOutFunc = async () => {
    try {
      await firebaseSignOut(auth);
      // setUser(null) will be handled by onAuthStateChanged.
      // router.push('/auth/login') will be handled by the navigation useEffect.
    } catch (error) {
      console.error("Error signing out: ", error);
      // Optionally, you could show a toast here if sign-out fails for some reason.
    }
  };
  
  // AuthProvider always renders the Provider.
  // Consumers like AppLayout will use 'loading' and 'user' from context
  // to decide what to render (e.g., their own loaders or content).
  return (
    <AuthContext.Provider value={{ user, loading, signOut: signOutFunc }}>
      {children}
    </AuthContext.Provider>
  );
};

