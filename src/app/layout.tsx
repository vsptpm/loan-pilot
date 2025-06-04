import type { Metadata } from 'next';
import './globals.css';
import { Alegreya, Belleza } from 'next/font/google'; // Import Belleza and Alegreya
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'LoanPilot',
  description: 'Manage your personal loans effectively with LoanPilot.',
};

// Configure Belleza font for headlines
const belleza = Belleza({
  subsets: ['latin'],
  weight: ['400'], // Belleza is typically available in regular weight
  variable: '--font-belleza',
});

// Configure Alegreya font for body text
const alegreya = Alegreya({
  subsets: ['latin'],
  weight: ['400', '500', '700'], // Include various weights if needed
  style: ['normal', 'italic'],
  variable: '--font-alegreya',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts preconnect for Belleza and Alegreya are handled by next/font */}
      </head>
      {/* Apply font variables and Tailwind's font-sans/font-headline class */}
      <body className={`${belleza.variable} ${alegreya.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
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
