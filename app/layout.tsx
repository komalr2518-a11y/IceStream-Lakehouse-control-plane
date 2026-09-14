import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ResizeObserverGuard } from './components/ResizeObserverGuard';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');

export const metadata: Metadata = {
  title: 'IceStream | Lakehouse Observability',
  description: 'A real-time control plane for governed, self-healing data pipelines.',
  metadataBase: siteOrigin,
  openGraph: {
    title: 'IceStream | Lakehouse Observability',
    description: 'A real-time control plane for governed, self-healing data pipelines.',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'IceStream real-time lakehouse observability' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IceStream | Lakehouse Observability',
    description: 'A real-time control plane for governed, self-healing data pipelines.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}><ResizeObserverGuard />{children}</body></html>;
}
