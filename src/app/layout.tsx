import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { StylesSafelist } from '@/modules/chat/components/StylesSafelist';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
});

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'Lohia College AI | Official Assistant Churu',
    template: '%s | Lohia College AI'
  },
  description: 'Official AI Assistant for Lohia College, Churu. Get instant help with exam schedules, results, faculty information, and admission details.',
  keywords: ['Lohia College', 'Lohia College Churu', 'Lohia AI', 'Lohia College Assistant', 'Churu College', 'Lohia College Exam Results', 'Lohia College Admission'],
  authors: [{ name: 'Lohia College AI Team' }],
  creator: 'Lohia College AI',
  publisher: 'Lohia College, Churu',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lohia College AI',
  },
  icons: {
    icon: '/lohia-logo.webp',
    apple: '/lohia-logo.webp',
    shortcut: '/lohia-logo.webp',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://lohia-college.ai', // Placeholder, user will replace with actual domain
    siteName: 'Lohia College AI Assistant',
    title: 'Lohia College AI | The Smart Way to College',
    description: 'Get all your Lohia College info instantly: Exams, Results, Faculty, and more.',
    images: [
      {
        url: '/lohia-logo.webp',
        width: 1200,
        height: 630,
        alt: 'Lohia College AI Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lohia College AI Assistant',
    description: 'Instant info for Lohia College students.',
    images: ['/lohia-logo.webp'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { PWARegistration } from '@/components/common/PWARegistration';
import { StickyShareButton } from '@/components/common/StickyShareButton';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-white dark:bg-black text-black dark:text-white" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
          <PWARegistration />
          {children}
          <StickyShareButton />
          <StylesSafelist />
        </ThemeProvider>
      </body>
    </html>
  );
}
