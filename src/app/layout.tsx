
import type { Metadata } from 'next';
import './globals.css';
import { Alegreya, Belleza } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'LoanPilot',
  description: 'Manage your personal loans effectively with LoanPilot.',
};

const alegreya = Alegreya({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-alegreya',
  weight: ['400', '500', '700', '800', '900'] // Include desired weights
});

const belleza = Belleza({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-belleza',
  weight: '400', // Belleza typically only has regular weight
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${alegreya.variable} ${belleza.variable}`} suppressHydrationWarning>
      <head>
        {/* Removed Google Fonts preconnect as next/font handles it */}
      </head>
      {/* font-sans will apply Alegreya, font-headline will apply Belleza due to tailwind.config */}
      <body className={`antialiased min-h-screen bg-background text-foreground font-sans`}>
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
