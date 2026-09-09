import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
// Distinct display face for headlines only (h1/h2, wired via --font-heading
// in globals.css) — Manrope stays the body/UI font. Two families in the
// same geometric-sans family so they read as one system, not a clash.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Corridor Sourcing',
  description:
    'Achetez au prix de gros à Cotonou grâce à des agents vérifiés sur le terrain, sans vous déplacer.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn('font-sans', manrope.variable, spaceGrotesk.variable)}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
