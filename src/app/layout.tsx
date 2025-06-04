
import type { Metadata } from 'next';
import './globals.css';
// Alegreya and Belleza imports removed
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'LoanPilot',
  description: 'Manage your personal loans effectively with LoanPilot.',
};

// Belleza and Alegreya font configurations removed

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts preconnect reverted or assuming default behavior */}
      </head>
      {/* Font variables removed from body className */}
      <body className={`antialiased min-h-screen bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
