import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Larp v1.1 — Touch me not reference app',
  description: 'Capacitor-powered bundler API and console that packages static HTML/CSS/JS into native Android APKs, Play Store AABs, and iOS packages with true fullscreen, dynamic theme-color syncing, splash screens, and Duolingo-style dynamic app icon swapping.',
  openGraph: {
    title: 'LARP - Offline Web-to-Native App Bundler API',
    description: 'Capacitor-powered bundler API and console that packages static HTML/CSS/JS into native Android APKs, Play Store AABs, and iOS packages with true fullscreen, dynamic theme-color syncing, splash screens, and Duolingo-style dynamic app icon swapping.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LARP - Offline Web-to-Native App Bundler API',
    description: 'Capacitor-powered bundler API and console that packages static HTML/CSS/JS into native Android APKs, Play Store AABs, and iOS packages with true fullscreen, dynamic theme-color syncing, splash screens, and Duolingo-style dynamic app icon swapping.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
