'use client';

import { Navbar } from '@/components/core/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { redirect } from 'next/navigation';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // This should ideally be handled by AuthProvider's redirect,
    // but as a fallback or for server components this might be useful.
    // For client components, AuthProvider handles redirection.
    // redirect('/auth/login');
    return null; // AuthProvider will handle redirect
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container py-8">
        {children}
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with ❤️ by LoanPilot Team.
          </p>
        </div>
      </footer>
    </div>
  );
}