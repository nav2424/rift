'use client'

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import Providers from "@/components/Providers";
import ScrollToTop from "@/components/ScrollToTop";
import Chatbot from "@/components/Chatbot";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import MarketingLayout from "@/components/layouts/MarketingLayout";
import AppLayout from "@/components/layouts/AppLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata is now defined in individual page.tsx files or specific layout files
// This root layout focuses on structural elements and global providers.

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isMarketingRoute = [
    '/',
    '/landing',
    '/pricing',
    '/about',
    '/auth/signin',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
  ].includes(pathname);

  const isAuthenticated = status === 'authenticated';

  // Render loading state if session is still loading
  if (status === 'loading') {
    return (
      <html lang="en" className="dark" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen flex flex-col items-center justify-center`}
        >
          <div className="text-white/60 font-light">Loading...</div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen flex flex-col`}
      >
        <Providers>
          <ScrollToTop />
          {isAuthenticated && !isMarketingRoute ? (
            <AppLayout>{children}</AppLayout>
          ) : (
            <MarketingLayout>{children}</MarketingLayout>
          )}
          <Chatbot />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
