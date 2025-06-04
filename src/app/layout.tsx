
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed to Inter
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'LoanPilot',
  description: 'Manage your personal loans effectively with LoanPilot.',
};

const inter = Inter({ // Using Inter font
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter', // Added variable for consistency if needed
});


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
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
