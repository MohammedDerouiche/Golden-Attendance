import type { Metadata } from 'next';
import './globals.css';
import { SelectedUserProvider } from '@/context/SelectedUserContext';
import Header from '@/components/layout/Header';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Poppins, PT_Sans, Source_Code_Pro } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-poppins',
});

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
});


export const metadata: Metadata = {
  title: 'GoldenClock',
  description: 'A simple time attendance app.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={cn(
          'font-body antialiased min-h-screen bg-background text-foreground',
           poppins.variable, 
           ptSans.variable, 
           sourceCodePro.variable
        )}
      >
        <SelectedUserProvider>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </SelectedUserProvider>
      </body>
    </html>
  );
}
