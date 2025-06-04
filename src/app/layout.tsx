
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed to Inter
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from 'next-themes';
import { Suspense } from 'react'; // Added Suspense

export const metadata: Metadata = {
  title: 'LoanPilot',
  description: 'Manage your personal loans effectively with LoanPilot.',
};

const inter = Inter({ // Using Inter font
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter', // Added variable for consistency if needed
});

// Define a simple fallback for RootLayout
function RootLayoutLoadingFallback() {
  // Basic inline styles to avoid dependency on Tailwind CSS not yet loaded or specific components
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    // Attempt to use CSS variables if they are defined early, otherwise fallback
    backgroundColor: 'var(--background, #f9fafb)', // Fallback to a light gray
    color: 'var(--foreground, #030712)', // Fallback to a dark color
    fontFamily: 'sans-serif',
  };
  return (
    <div style={style}>
      <p>Loading LoanPilot...</p>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
      </head>
      <body className={`antialiased min-h-screen bg-background text-foreground font-sans ${inter.className}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Suspense fallback={<RootLayoutLoadingFallback />}>
              {children}
            </Suspense>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
