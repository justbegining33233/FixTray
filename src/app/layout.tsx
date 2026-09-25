import "./globals.css";
import { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import ClientAuthProvider from '@/components/ClientAuthProvider';
import OfflineBanner from '@/components/OfflineBanner';
import FloatingSignOut from '@/components/FloatingSignOut';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import TechOfflineBridge from '@/components/TechOfflineBridge';
import { NativeProvider } from '@/context/NativeContext';
import NativeStatusBar from '@/components/NativeStatusBar';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { installedShellBootstrapScript } from '@/lib/nativeIntro';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#e5332a',
};

export const metadata: Metadata = {
  title: "FixTray - Work Order Management",
  description: "Streamlined work order management for roadside and in-shop services",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FixTray',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
      { url: '/icons/fixtray-ft-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/fixtray-ft-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/fixtray-ft-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/fixtray-ft-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  // Performance optimizations
  other: {
    'dns-prefetch': 'https://res.cloudinary.com',
    'preconnect': 'https://api.stripe.com',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the native flag injected by middleware (from the Android cookie).
  // This runs server-side so the correct layout is rendered from byte 1.
  const headersList = await headers();
  const nativeHeader = headersList.get('x-fixtray-native') as 'android' | 'ios' | null;
  const isNative = nativeHeader === 'android' || nativeHeader === 'ios';

  // Detect mobile browsers server-side so the initial render never flashes
  // desktop layout on phones/tablets.
  const ua = headersList.get('user-agent') ?? '';
  const isMobileUA = isNative || /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: installedShellBootstrapScript() }} />
      </head>
      <body className={`${inter.variable} ${plusJakartaSans.variable}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ErrorBoundary>
            <NativeProvider isNative={isNative} platform={nativeHeader ?? null} isMobileUA={isMobileUA}>
              <ClientAuthProvider>
                <NativeStatusBar />
                {children}
                <OfflineBanner />
                <TechOfflineBridge />
                <FloatingSignOut />
                <ServiceWorkerRegister />
              </ClientAuthProvider>
            </NativeProvider>
          </ErrorBoundary>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
